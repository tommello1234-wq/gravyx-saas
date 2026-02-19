import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PASSWORD = 'Gravyx@2025!';
const LOGIN_URL = 'https://app.gravyx.com.br';

// Mapeamento price_id -> config do plano
interface PlanConfig {
  credits: number;
  tier: string;
  billing_cycle: string;
  max_projects: number;
}

const PRICE_CONFIG: Record<string, PlanConfig> = {
  // Starter
  'price_1T2dH9QaS2QCKPVAO3z0v3as': { credits: 80,   tier: 'starter',    billing_cycle: 'monthly', max_projects: 3  },
  'price_1T2dI8QaS2QCKPVA5KUWv6A1': { credits: 1000, tier: 'starter',    billing_cycle: 'annual',  max_projects: 3  },
  // Premium
  'price_1T2dNOQaS2QCKPVAPcfLgTg6': { credits: 250,  tier: 'premium',    billing_cycle: 'monthly', max_projects: -1 },
  'price_1T2dNfQaS2QCKPVAZ6xDyCDl': { credits: 3000, tier: 'premium',    billing_cycle: 'annual',  max_projects: -1 },
  // Enterprise
  'price_1T2dSeQaS2QCKPVAboY5jaQF': { credits: 600,  tier: 'enterprise', billing_cycle: 'monthly', max_projects: -1 },
  'price_1T2dT8QaS2QCKPVAf7yajEeK': { credits: 7200, tier: 'enterprise', billing_cycle: 'annual',  max_projects: -1 },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2025-08-27.basil',
  });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[STRIPE-WH] STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Server misconfiguration', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('[STRIPE-WH] Signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  console.log(`[STRIPE-WH] Event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, stripe, event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice, event.id);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, stripe, event.data.object as Stripe.Subscription);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(supabase, stripe, event.data.object as Stripe.Charge);
        break;

      case 'invoice.payment_failed':
        console.log(`[STRIPE-WH] Payment failed for invoice ${(event.data.object as Stripe.Invoice).id}`);
        await logWebhook(supabase, event.type, { event_id: event.id }, true, 'Payment failed - logged');
        break;

      default:
        console.log(`[STRIPE-WH] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[STRIPE-WH] Error handling ${event.type}:`, msg);
    await logWebhook(supabase, event.type, { event_id: event.id }, false, msg);
    return new Response('Webhook handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// === checkout.session.completed (trial started) ===
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const customerEmail = session.customer_details?.email || session.customer_email;
  if (!customerEmail) {
    console.error('[STRIPE-WH] No email in checkout session');
    return;
  }

  // Get subscription to extract metadata and price
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  const config = priceId ? PRICE_CONFIG[priceId] : null;
  const tier = config?.tier || subscription.metadata?.tier || 'starter';
  const maxProjects = config?.max_projects ?? 3;

  const profile = await findOrCreateProfile(supabase, customerEmail, session.customer_details?.name);

  if (!profile) {
    console.error(`[STRIPE-WH] Failed to find/create profile: ${customerEmail}`);
    await logWebhook(supabase, 'checkout.session.completed', { email: customerEmail }, false, 'Profile not found');
    return;
  }

  // If trial is active, set trial status
  if (subscription.status === 'trialing') {
    // Check if already active/trialing - prevent duplicate
    const { data: current } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('user_id', profile.user_id)
      .single();

    if (current?.subscription_status === 'trial_active' || current?.subscription_status === 'active') {
      console.log(`[STRIPE-WH] Duplicate checkout ignored for ${customerEmail} (status: ${current.subscription_status})`);
      await logWebhook(supabase, 'checkout.session.completed', { email: customerEmail }, true, 'Duplicate ignored');
      return;
    }

    const { error } = await supabase.from('profiles').update({
      subscription_status: 'trial_active',
      trial_start_date: new Date().toISOString(),
      trial_credits_given: 5,
      credits: 5,
      tier,
      max_projects: maxProjects,
    }).eq('user_id', profile.user_id);

    if (error) {
      console.error(`[STRIPE-WH] Trial activation failed:`, error.message);
      await logWebhook(supabase, 'checkout.session.completed', { email: customerEmail }, false, error.message);
      return;
    }

    console.log(`[STRIPE-WH] Trial activated: ${customerEmail} → ${tier}`);
  }

  await logWebhook(supabase, 'checkout.session.completed', { email: customerEmail, tier }, true);
}

// === invoice.paid (subscription payment succeeded) ===
async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
  eventId: string
) {
  // Skip trial invoices (amount = 0)
  if (!invoice.amount_paid || invoice.amount_paid === 0) {
    console.log('[STRIPE-WH] Skipping zero-amount invoice (trial)');
    return;
  }

  const customerEmail = invoice.customer_email;
  if (!customerEmail) {
    console.error('[STRIPE-WH] No email on invoice');
    return;
  }

  const transactionId = `stripe:${invoice.id}`;

  // Duplicate check
  const { data: existing } = await supabase
    .from('credit_purchases')
    .select('id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (existing) {
    console.log(`[STRIPE-WH] Invoice already processed: ${invoice.id}`);
    return;
  }

  // Get price from invoice line items
  const priceId = invoice.lines?.data?.[0]?.price?.id;
  const config = priceId ? PRICE_CONFIG[priceId] : null;

  if (!config) {
    console.error(`[STRIPE-WH] Unknown price on invoice: ${priceId}`);
    await logWebhook(supabase, 'invoice.paid', { invoice_id: invoice.id, price_id: priceId }, false, 'Unknown price');
    return;
  }

  const profile = await findOrCreateProfile(supabase, customerEmail);
  if (!profile) {
    console.error(`[STRIPE-WH] Profile not found for invoice: ${customerEmail}`);
    await logWebhook(supabase, 'invoice.paid', { email: customerEmail }, false, 'Profile not found');
    return;
  }

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      credits: profile.credits + config.credits,
      tier: config.tier,
      billing_cycle: config.billing_cycle,
      max_projects: config.max_projects,
      subscription_status: 'active',
      trial_credits_given: 0,
    })
    .eq('user_id', profile.user_id);

  if (updateError) {
    console.error(`[STRIPE-WH] Failed to update profile:`, updateError.message);
    await logWebhook(supabase, 'invoice.paid', { email: customerEmail }, false, updateError.message);
    return;
  }

  // Record purchase
  await supabase.from('credit_purchases').insert({
    user_id: profile.user_id,
    transaction_id: transactionId,
    product_id: priceId || 'unknown',
    credits_added: config.credits,
    amount_paid: invoice.amount_paid,
    customer_email: customerEmail.toLowerCase().trim(),
    raw_payload: { event_id: eventId, invoice_id: invoice.id },
  });

  console.log(`[STRIPE-WH] ${config.credits} credits added for ${customerEmail} (${config.tier}/${config.billing_cycle})`);
  await logWebhook(supabase, 'invoice.paid', { email: customerEmail, credits: config.credits }, true);
}

// === customer.subscription.updated (cancellation scheduled) ===
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  if (subscription.cancel_at_period_end) {
    const email = subscription.metadata?.customer_email || '';
    console.log(`[STRIPE-WH] Subscription cancellation scheduled: ${subscription.id}`);
    await logWebhook(supabase, 'customer.subscription.updated', {
      subscription_id: subscription.id,
      cancel_at_period_end: true,
    }, true, 'Cancellation scheduled - benefits kept until period end');
  }
}

// === customer.subscription.deleted (subscription ended) ===
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  // Get customer email
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (customer.deleted) return;

  const email = customer.email;
  if (!email) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, credits')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (!profile) return;

  await supabase.from('profiles').update({
    tier: 'free',
    billing_cycle: 'monthly',
    max_projects: 1,
    subscription_status: 'inactive',
  }).eq('user_id', profile.user_id);

  console.log(`[STRIPE-WH] Subscription deleted: ${email} → Free`);
  await logWebhook(supabase, 'customer.subscription.deleted', { email }, true);
}

// === charge.refunded ===
async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  charge: Stripe.Charge
) {
  const email = charge.billing_details?.email || charge.receipt_email;
  if (!email) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, credits')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (!profile) return;

  // Find original purchase to determine credits to reverse
  let creditsToRemove = 0;
  if (charge.payment_intent) {
    const { data: purchase } = await supabase
      .from('credit_purchases')
      .select('credits_added')
      .eq('transaction_id', `stripe:${charge.invoice}`)
      .maybeSingle();
    creditsToRemove = purchase?.credits_added || 0;
  }

  await supabase.from('profiles').update({
    credits: Math.max(0, profile.credits - creditsToRemove),
    tier: 'free',
    billing_cycle: 'monthly',
    max_projects: 1,
    subscription_status: 'inactive',
  }).eq('user_id', profile.user_id);

  console.log(`[STRIPE-WH] Refund: ${email} → Free (−${creditsToRemove} credits)`);
  await logWebhook(supabase, 'charge.refunded', { email, credits_removed: creditsToRemove }, true);
}

// === Helper: find or create profile (with auto-account creation) ===
async function findOrCreateProfile(
  supabase: ReturnType<typeof createClient>,
  email: string,
  customerName?: string | null
): Promise<{ user_id: string; credits: number; tier: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data } = await supabase
    .from('profiles')
    .select('user_id, credits, tier')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (data) return data;

  // Auto-create account
  console.log(`[STRIPE-WH] Auto-creating account for: ${normalizedEmail}`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: customerName || normalizedEmail.split('@')[0] },
  });

  if (authError) {
    console.error(`[STRIPE-WH] Auth create failed: ${authError.message}`);
    return null;
  }

  const userId = authData.user.id;

  // Wait for trigger to create profile
  let profile = null;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    const { data: p } = await supabase
      .from('profiles')
      .select('user_id, credits, tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (p) { profile = p; break; }
  }

  if (!profile) {
    console.error(`[STRIPE-WH] Profile not created by trigger for: ${userId}`);
    return null;
  }

  // Send welcome email
  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
    await resend.emails.send({
      from: 'Gravyx <noreply@upwardacademy.com.br>',
      to: [normalizedEmail],
      subject: 'Sua conta Gravyx foi criada! 🚀',
      html: buildWelcomeHtml(normalizedEmail, DEFAULT_PASSWORD, LOGIN_URL),
    });
    console.log(`[STRIPE-WH] Welcome email sent to: ${normalizedEmail}`);
  } catch (e) {
    console.error(`[STRIPE-WH] Email error:`, e);
  }

  return profile;
}

// === Helpers ===
async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  payload: unknown,
  processed: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from('webhook_logs').insert({
      event_type: `stripe:${eventType}`,
      payload: payload as Record<string, unknown>,
      processed,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error('[STRIPE-WH] Log error:', e);
  }
}

function buildWelcomeHtml(email: string, password: string, loginUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="background-color:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
<div style="margin:0 auto;padding:40px 20px;max-width:600px;">
  <div style="text-align:center;margin-bottom:32px;">
    <p style="font-size:28px;font-weight:bold;color:#00b8ff;margin:0;">🚀 Gravyx</p>
  </div>
  <div style="background-color:#0f0f1a;border:1px solid rgba(0,135,255,0.15);border-radius:16px;padding:32px;box-shadow:0 0 40px rgba(0,135,255,0.1);">
    <h1 style="color:#fafafa;font-size:24px;font-weight:bold;text-align:center;margin:0 0 16px 0;">Sua conta foi criada! 🎉</h1>
    <p style="color:#71717a;font-size:16px;line-height:24px;text-align:center;margin:0 0 24px 0;">
      Você adquiriu um plano no Gravyx e criamos sua conta automaticamente. Use as credenciais abaixo para acessar:
    </p>
    <div style="background-color:#0a0a14;border:1px solid rgba(0,135,255,0.15);border-radius:8px;padding:12px 16px;margin-bottom:12px;">
      <p style="color:#71717a;font-size:13px;margin:0 0 4px 0;">📧 Email de acesso</p>
      <p style="color:#fafafa;font-size:16px;font-weight:bold;margin:0;">${email}</p>
    </div>
    <div style="background-color:#0a0a14;border:1px solid rgba(0,135,255,0.15);border-radius:8px;padding:12px 16px;margin-bottom:12px;">
      <p style="color:#71717a;font-size:13px;margin:0 0 4px 0;">🔑 Senha de acesso</p>
      <p style="color:#00b8ff;font-size:20px;font-weight:bold;letter-spacing:2px;margin:0;">${password}</p>
    </div>
    <div style="background-color:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:12px 16px;margin:16px 0 24px 0;">
      <p style="color:#fbbf24;font-size:14px;line-height:20px;margin:0;text-align:center;">
        ⚠️ Esta é uma senha padrão. Recomendamos que você a troque após o primeiro acesso.
      </p>
    </div>
    <a href="${loginUrl}" style="display:block;background:linear-gradient(135deg,#00b8ff,#001eff);color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 32px;border-radius:9999px;box-shadow:0 0 20px rgba(0,135,255,0.4);margin:0 auto;">
      Acessar o Gravyx
    </a>
    <hr style="border-color:rgba(0,135,255,0.15);margin:24px 0;">
    <p style="color:#71717a;font-size:14px;line-height:22px;text-align:center;margin:0;">
      Se você não realizou esta compra, entre em contato com nosso suporte.
    </p>
  </div>
  <div style="text-align:center;margin-top:32px;">
    <p style="color:#71717a;font-size:12px;margin:0;">© ${new Date().getFullYear()} Gravyx · Geração de Imagens com IA</p>
  </div>
</div>
</body>
</html>`;
}
