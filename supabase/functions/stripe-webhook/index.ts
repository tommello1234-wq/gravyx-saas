import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "Gravyx@2025!";
const LOGIN_URL = "https://app.gravyx.com.br";

// Tier benefits (same as Ticto webhook)
const TIER_BENEFITS: Record<string, { credits: number; max_projects: number }> = {
  starter:    { credits: 80,  max_projects: 3  },
  premium:    { credits: 250, max_projects: -1 },
  enterprise: { credits: 600, max_projects: -1 },
};

// price_id → tier mapping
const PRICE_TO_TIER: Record<string, string> = {
  "price_1T2dH9QaS2QCKPVAO3z0v3as": "starter",
  "price_1T2dNOQaS2QCKPVAPcfLgTg6": "premium",
  "price_1T2dSeQaS2QCKPVAboY5jaQF": "enterprise",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

// ─── Helpers ────────────────────────────────────────────────────────

async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  payload: unknown,
  processed: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from("webhook_logs").insert({
      event_type: `stripe:${eventType}`,
      payload: payload as Record<string, unknown>,
      processed,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error("Failed to log webhook:", e);
  }
}

async function findOrCreateProfile(
  supabase: ReturnType<typeof createClient>,
  email: string,
  customerName?: string
) {
  const normalizedEmail = email.toLowerCase().trim();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, credits, tier, subscription_status")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (data) return data;

  // Auto-create account
  log("Auto-creating account", { email: normalizedEmail });
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: customerName || normalizedEmail.split("@")[0] },
  });

  if (authError) {
    log("Auth create error", { error: authError.message });
    return null;
  }

  const userId = authData.user.id;

  // Wait for trigger to create profile
  let profile = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id, credits, tier, subscription_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (p) { profile = p; break; }
  }

  if (!profile) {
    log("Profile not created by trigger", { userId });
    return null;
  }

  // Send welcome email
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
    await resend.emails.send({
      from: "Gravyx <noreply@gravyx.com.br>",
      to: [normalizedEmail],
      subject: "Sua conta Gravyx foi criada! 🚀",
      html: `<p>Olá! Sua conta foi criada.<br>Email: ${normalizedEmail}<br>Senha: ${DEFAULT_PASSWORD}<br><a href="${LOGIN_URL}">Acessar</a></p>`,
    });
  } catch (e) {
    log("Welcome email error", { error: String(e) });
  }

  return profile;
}

// ─── Main handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify webhook signature
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    log("Missing signature or webhook secret");
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    log("Signature verification failed", { error: String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  log("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      // ── Checkout completed ──────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const tier = session.metadata?.tier;
        const subscriptionId = session.subscription as string;

        if (!customerEmail || !tier) {
          log("Missing email or tier in session", { customerEmail, tier });
          await logWebhook(supabase, event.type, { session_id: session.id }, false, "Missing email or tier");
          break;
        }

        const benefits = TIER_BENEFITS[tier];
        if (!benefits) {
          log("Unknown tier", { tier });
          await logWebhook(supabase, event.type, { session_id: session.id }, false, `Unknown tier: ${tier}`);
          break;
        }

        // Check for duplicate
        const txId = `stripe_checkout_${session.id}`;
        const { data: existing } = await supabase
          .from("credit_purchases")
          .select("id")
          .eq("transaction_id", txId)
          .maybeSingle();

        if (existing) {
          log("Already processed", { txId });
          await logWebhook(supabase, event.type, { session_id: session.id }, true, "Already processed");
          break;
        }

        const profile = await findOrCreateProfile(supabase, customerEmail);
        if (!profile) {
          await logWebhook(supabase, event.type, { session_id: session.id }, false, "Profile not found/created");
          break;
        }

        // If it's a trial (no payment yet), activate as trial
        const isTrial = session.payment_status === "no_payment_required";
        const subStatus = isTrial ? "trial_active" : "active";

        // Guard: skip if user already active/trial (avoid duplicate credits)
        if (profile.subscription_status === "active" || profile.subscription_status === "trial_active") {
          log("User already active, skipping credit addition", { userId: profile.user_id, status: profile.subscription_status });
          await logWebhook(supabase, event.type, { session_id: session.id }, true, "User already active");
          break;
        }

        await supabase.from("profiles").update({
          credits: profile.credits + benefits.credits,
          tier,
          billing_cycle: "monthly",
          max_projects: benefits.max_projects,
          subscription_status: subStatus,
          trial_start_date: isTrial ? new Date().toISOString() : null,
        }).eq("user_id", profile.user_id);

        await supabase.from("credit_purchases").insert({
          user_id: profile.user_id,
          transaction_id: txId,
          product_id: `stripe_${tier}_monthly`,
          credits_added: benefits.credits,
          amount_paid: session.amount_total || 0,
          customer_email: customerEmail.toLowerCase().trim(),
          raw_payload: { stripe_event: event.type, session_id: session.id, subscription_id: subscriptionId },
        });

        log("Checkout activated", { email: customerEmail, tier, credits: benefits.credits, status: subStatus });
        await logWebhook(supabase, event.type, { session_id: session.id, tier }, true);
        break;
      }

      // ── Invoice paid (renewal) ─────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        // Skip the first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === "subscription_create") {
          log("Skipping initial invoice (handled by checkout)");
          await logWebhook(supabase, event.type, { invoice_id: invoice.id }, true, "Initial invoice skipped");
          break;
        }

        const customerEmail = invoice.customer_email;
        if (!customerEmail) {
          log("No customer email on invoice");
          await logWebhook(supabase, event.type, { invoice_id: invoice.id }, false, "No email");
          break;
        }

        // Determine tier from line items
        const priceId = invoice.lines?.data?.[0]?.price?.id;
        const tier = priceId ? PRICE_TO_TIER[priceId] : null;
        if (!tier) {
          log("Unknown price_id on invoice", { priceId });
          await logWebhook(supabase, event.type, { invoice_id: invoice.id }, false, `Unknown price: ${priceId}`);
          break;
        }

        const benefits = TIER_BENEFITS[tier];
        const txId = `stripe_invoice_${invoice.id}`;

        const { data: existingPurchase } = await supabase
          .from("credit_purchases")
          .select("id")
          .eq("transaction_id", txId)
          .maybeSingle();

        if (existingPurchase) {
          log("Invoice already processed", { txId });
          await logWebhook(supabase, event.type, { invoice_id: invoice.id }, true, "Already processed");
          break;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, credits")
          .eq("email", customerEmail.toLowerCase().trim())
          .maybeSingle();

        if (!profile) {
          log("Profile not found for renewal", { email: customerEmail });
          await logWebhook(supabase, event.type, { invoice_id: invoice.id }, false, "Profile not found");
          break;
        }

        await supabase.from("profiles").update({
          credits: profile.credits + benefits.credits,
          tier,
          subscription_status: "active",
          billing_cycle: "monthly",
          max_projects: benefits.max_projects,
        }).eq("user_id", profile.user_id);

        await supabase.from("credit_purchases").insert({
          user_id: profile.user_id,
          transaction_id: txId,
          product_id: `stripe_${tier}_monthly`,
          credits_added: benefits.credits,
          amount_paid: invoice.amount_paid || 0,
          customer_email: customerEmail.toLowerCase().trim(),
          raw_payload: { stripe_event: event.type, invoice_id: invoice.id },
        });

        log("Renewal processed", { email: customerEmail, tier, credits: benefits.credits });
        await logWebhook(supabase, event.type, { invoice_id: invoice.id, tier }, true);
        break;
      }

      // ── Subscription deleted ───────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;

        if (!email) {
          log("No email for deleted subscription");
          await logWebhook(supabase, event.type, { sub_id: subscription.id }, false, "No email");
          break;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, credits")
          .eq("email", email.toLowerCase().trim())
          .maybeSingle();

        if (!profile) {
          log("Profile not found for cancellation", { email });
          await logWebhook(supabase, event.type, { sub_id: subscription.id }, false, "Profile not found");
          break;
        }

        // Check if trial was cancelled before first payment — revoke credits
        const wasTrial = subscription.status === "trialing" || !subscription.latest_invoice;
        const creditsToRemove = wasTrial ? profile.credits : 0;

        await supabase.from("profiles").update({
          credits: Math.max(0, profile.credits - creditsToRemove),
          tier: "free",
          billing_cycle: "monthly",
          max_projects: 1,
          subscription_status: "inactive",
          trial_start_date: null,
        }).eq("user_id", profile.user_id);

        log("Subscription deleted → Free", { email, wasTrial, creditsRemoved: creditsToRemove });
        await logWebhook(supabase, event.type, { sub_id: subscription.id, email }, true);
        break;
      }

      // ── Payment failed ─────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        log("Payment failed", { email: invoice.customer_email, invoice_id: invoice.id });
        await logWebhook(supabase, event.type, { invoice_id: invoice.id, email: invoice.customer_email }, true, "Payment failed - logged");
        break;
      }

      default:
        log("Unhandled event type", { type: event.type });
        await logWebhook(supabase, event.type, { event_id: event.id }, false, "Unhandled event");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR processing event", { type: event.type, message: msg });
    await logWebhook(supabase, event.type, { event_id: event.id }, false, msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
