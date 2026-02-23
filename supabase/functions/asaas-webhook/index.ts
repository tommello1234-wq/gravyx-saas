import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ASAAS-WEBHOOK] ${step}${d}`);
};

// Annual plan config by tier
interface TierConfig {
  credits: number;
  tier: string;
  max_projects: number;
}

const TIER_FROM_REF: Record<string, TierConfig> = {
  starter:    { credits: 1000, tier: "starter",    max_projects: 3  },
  premium:    { credits: 3000, tier: "premium",    max_projects: -1 },
  enterprise: { credits: 7200, tier: "enterprise", max_projects: -1 },
};

function parseTierFromReference(externalReference: string): { tier: string; userId: string } | null {
  // Format: gravyx_annual_{tier}_{userId}
  const match = externalReference.match(/^gravyx_annual_(starter|premium|enterprise)_(.+)$/);
  if (!match) return null;
  return { tier: match[1], userId: match[2] };
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

  // Parse tier and userId from externalReference
  const parsed = parseTierFromReference(externalReference);

  // --- PAYMENT_CONFIRMED / PAYMENT_RECEIVED → activate annual plan ---
  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    if (!parsed) {
      logStep("Unknown externalReference, ignoring", { externalReference });
      await logWebhook(supabase, event, body, false, `Unknown externalReference: ${externalReference}`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const { tier, userId } = parsed;
    const config = TIER_FROM_REF[tier];
    if (!config) {
      await logWebhook(supabase, event, body, false, `Unknown tier: ${tier}`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const paymentId = (payment.id as string) || `asaas_${Date.now()}`;

    // Check for duplicate
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

    // Get current profile
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

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        credits: profile.credits + config.credits,
        tier: config.tier,
        billing_cycle: "annual",
        max_projects: config.max_projects,
        subscription_status: "active",
      })
      .eq("user_id", userId);

    if (updateError) {
      logStep("Update failed", updateError);
      await logWebhook(supabase, event, body, false, `Update failed: ${updateError.message}`);
      return new Response("Processing failed", { status: 500, headers: corsHeaders });
    }

    // Record purchase
    await supabase.from("credit_purchases").insert({
      user_id: userId,
      transaction_id: paymentId,
      product_id: `asaas_annual_${tier}`,
      credits_added: config.credits,
      amount_paid: (payment.value as number) || 0,
      customer_email: profile.email,
      raw_payload: body,
    });

    logStep("Plan activated", { userId, tier, credits: config.credits });
    await logWebhook(supabase, event, body, true);
    return new Response(JSON.stringify({ success: true, action: "plan_activated" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- PAYMENT_REFUNDED / PAYMENT_CHARGEBACK_REQUESTED → downgrade to Free ---
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
      }).eq("user_id", userId);
      logStep("Downgraded to free", { userId });
    }

    await logWebhook(supabase, event, body, true);
    return new Response(JSON.stringify({ success: true, action: "downgraded" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- PAYMENT_OVERDUE → just log ---
  if (event === "PAYMENT_OVERDUE") {
    logStep("Payment overdue", { externalReference });
    await logWebhook(supabase, event, body, true, "Payment overdue - logged");
    return new Response(JSON.stringify({ success: true, action: "overdue_logged" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Other events → ignore ---
  logStep("Event ignored", { event });
  await logWebhook(supabase, event, body, false, `Event not handled: ${event}`);
  return new Response("OK", { status: 200, headers: corsHeaders });
});
