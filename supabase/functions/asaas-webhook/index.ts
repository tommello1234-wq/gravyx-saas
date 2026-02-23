import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ASAAS-WEBHOOK] ${step}${d}`);
};

interface TierConfig {
  credits: number;
  tier: string;
  max_projects: number;
  billing_cycle: string;
}

const TIER_CONFIG: Record<string, Record<string, TierConfig>> = {
  monthly: {
    starter:    { credits: 80,   tier: "starter",    max_projects: 3,  billing_cycle: "monthly" },
    premium:    { credits: 250,  tier: "premium",    max_projects: -1, billing_cycle: "monthly" },
    enterprise: { credits: 600,  tier: "enterprise", max_projects: -1, billing_cycle: "monthly" },
  },
  annual: {
    starter:    { credits: 1000, tier: "starter",    max_projects: 3,  billing_cycle: "annual" },
    premium:    { credits: 3000, tier: "premium",    max_projects: -1, billing_cycle: "annual" },
    enterprise: { credits: 7200, tier: "enterprise", max_projects: -1, billing_cycle: "annual" },
  },
};

function parseTierFromReference(ref: string): { tier: string; userId: string; cycle: string } | null {
  // New format: gravyx_{cycle}_{tier}_{userId}
  const m = ref.match(/^gravyx_(monthly|annual)_(starter|premium|enterprise)_(.+)$/);
  if (m) return { cycle: m[1], tier: m[2], userId: m[3] };
  // Legacy: gravyx_annual_{tier}_{userId}
  const legacy = ref.match(/^gravyx_annual_(starter|premium|enterprise)_(.+)$/);
  if (legacy) return { cycle: "annual", tier: legacy[1], userId: legacy[2] };
  return null;
}

async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  payload: unknown,
  processed: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from("webhook_logs").insert({
      event_type: `asaas_${eventType}`,
      payload: payload as Record<string, unknown>,
      processed,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error("Failed to log webhook:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let body: Record<string, unknown>;

  try {
    const rawBody = await req.text();
    if (rawBody.length > 50000) {
      await logWebhook(supabase, "payload_too_large", {}, false, "Payload exceeds 50KB");
      return new Response("Payload too large", { status: 413, headers: corsHeaders });
    }
    body = JSON.parse(rawBody);
    logStep("Webhook received", { event: body.event });
  } catch (e) {
    logStep("Parse error", e);
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  // Validate webhook token
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (expectedToken && receivedToken !== expectedToken) {
    logStep("Invalid token");
    await logWebhook(supabase, "invalid_token", body, false, "Invalid webhook token");
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const event = (body.event as string) || "";
  const payment = (body.payment as Record<string, unknown>) || {};
  const externalReference = (payment.externalReference as string) || "";

  logStep("Processing event", { event, externalReference });

  const parsed = parseTierFromReference(externalReference);

  // --- PAYMENT_CONFIRMED / PAYMENT_RECEIVED ---
  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    if (!parsed) {
      logStep("Unknown externalReference, ignoring", { externalReference });
      await logWebhook(supabase, event, body, false, `Unknown externalReference: ${externalReference}`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const { tier, userId, cycle } = parsed;
    const config = TIER_CONFIG[cycle]?.[tier];
    if (!config) {
      await logWebhook(supabase, event, body, false, `Unknown tier/cycle: ${tier}/${cycle}`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const paymentId = (payment.id as string) || `asaas_${Date.now()}`;

    const { data: existing } = await supabase
      .from("credit_purchases")
      .select("id")
      .eq("transaction_id", paymentId)
      .maybeSingle();

    if (existing) {
      logStep("Already processed", { paymentId });
      await logWebhook(supabase, event, body, true, "Already processed");
      return new Response("Already processed", { status: 200, headers: corsHeaders });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, credits, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      logStep("User not found", { userId });
      await logWebhook(supabase, event, body, false, `User not found: ${userId}`);
      return new Response("User not found", { status: 200, headers: corsHeaders });
    }

    // Build update payload — save subscription_id if present
    const updatePayload: Record<string, unknown> = {
      credits: profile.credits + config.credits,
      tier: config.tier,
      billing_cycle: config.billing_cycle,
      max_projects: config.max_projects,
      subscription_status: "active",
    };

    // Try to extract subscription ID from payment payload
    const subscriptionId = payment.subscription as string | undefined;
    if (subscriptionId) {
      updatePayload.asaas_subscription_id = subscriptionId;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", userId);

    if (updateError) {
      logStep("Update failed", updateError);
      await logWebhook(supabase, event, body, false, `Update failed: ${updateError.message}`);
      return new Response("Processing failed", { status: 500, headers: corsHeaders });
    }

    await supabase.from("credit_purchases").insert({
      user_id: userId,
      transaction_id: paymentId,
      product_id: `asaas_${cycle}_${tier}`,
      credits_added: config.credits,
      amount_paid: (payment.value as number) || 0,
      customer_email: profile.email,
      raw_payload: body,
    });

    logStep("Plan activated", { userId, tier, cycle, credits: config.credits, subscriptionId });
    await logWebhook(supabase, event, body, true);
    return new Response(JSON.stringify({ success: true, action: "plan_activated" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- PAYMENT_REFUNDED / PAYMENT_CHARGEBACK_REQUESTED ---
  if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
    if (!parsed) {
      await logWebhook(supabase, event, body, false, `Unknown ref: ${externalReference}`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const { userId } = parsed;
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, credits")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      await supabase.from("profiles").update({
        credits: 0,
        tier: "free",
        billing_cycle: "monthly",
        max_projects: 1,
        subscription_status: "inactive",
        asaas_subscription_id: null,
      }).eq("user_id", userId);
      logStep("Downgraded to free", { userId });
    }

    await logWebhook(supabase, event, body, true);
    return new Response(JSON.stringify({ success: true, action: "downgraded" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- PAYMENT_OVERDUE ---
  if (event === "PAYMENT_OVERDUE") {
    if (parsed) {
      const { userId } = parsed;
      await supabase.from("profiles").update({
        subscription_status: "past_due",
      }).eq("user_id", userId);
      logStep("Marked as past_due", { userId });
    }
    await logWebhook(supabase, event, body, true, "Payment overdue - marked past_due");
    return new Response(JSON.stringify({ success: true, action: "overdue_marked" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Other events ---
  logStep("Event ignored", { event });
  await logWebhook(supabase, event, body, false, `Event not handled: ${event}`);
  return new Response("OK", { status: 200, headers: corsHeaders });
});
