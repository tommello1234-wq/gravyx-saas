import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapeamento price_id -> config (para validação e trial)
const PRICE_CONFIG: Record<string, { tier: string; billing_cycle: string; trial_days: number }> = {
  'price_1T2dH9QaS2QCKPVAO3z0v3as': { tier: 'starter',    billing_cycle: 'monthly', trial_days: 7 },
  'price_1T2dI8QaS2QCKPVA5KUWv6A1': { tier: 'starter',    billing_cycle: 'annual',  trial_days: 7 },
  'price_1T2dNOQaS2QCKPVAPcfLgTg6': { tier: 'premium',    billing_cycle: 'monthly', trial_days: 7 },
  'price_1T2dNfQaS2QCKPVAZ6xDyCDl': { tier: 'premium',    billing_cycle: 'annual',  trial_days: 7 },
  'price_1T2dSeQaS2QCKPVAboY5jaQF': { tier: 'enterprise', billing_cycle: 'monthly', trial_days: 7 },
  'price_1T2dT8QaS2QCKPVAf7yajEeK': { tier: 'enterprise', billing_cycle: 'annual',  trial_days: 7 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { price_id } = await req.json();
    if (!price_id || !PRICE_CONFIG[price_id]) {
      throw new Error("Invalid price_id");
    }

    const config = PRICE_CONFIG[price_id];

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://app.gravyx.com.br";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: price_id, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/projects?checkout=success`,
      cancel_url: `${origin}/projects?checkout=cancelled`,
      subscription_data: {
        trial_period_days: config.trial_days,
        metadata: {
          supabase_user_id: user.id,
          tier: config.tier,
          billing_cycle: config.billing_cycle,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[CHECKOUT] Created session for ${user.email} - ${config.tier}/${config.billing_cycle}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
