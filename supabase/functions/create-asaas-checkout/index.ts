import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

interface PlanConfig {
  name: string;
  value: number;
  credits: number;
}

const ANNUAL_PLANS: Record<string, PlanConfig> = {
  starter:    { name: "Gravyx Starter Anual",    value: 420.00,  credits: 1000 },
  premium:    { name: "Gravyx Premium Anual",    value: 1097.00, credits: 3000 },
  enterprise: { name: "Gravyx Enterprise Anual", value: 2597.00, credits: 7200 },
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-ASAAS-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasKey) throw new Error("ASAAS_API_KEY is not set");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    if (!userEmail) throw new Error("User email not available");
    logStep("User authenticated", { userId, email: userEmail });

    // Parse body
    const { tier } = await req.json();
    if (!tier || !ANNUAL_PLANS[tier]) throw new Error("Invalid tier");
    logStep("Request body", { tier });

    const plan = ANNUAL_PLANS[tier];

    // Create Asaas Checkout session
    const checkoutPayload = {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["DETACHED", "INSTALLMENT"],
      minutesToExpire: 60,
      externalReference: `gravyx_annual_${tier}_${userId}`,
      callback: {
        successUrl: "https://app.gravyx.com.br/projects?checkout=success",
        cancelUrl: "https://app.gravyx.com.br/projects",
        expiredUrl: "https://app.gravyx.com.br/projects",
      },
      items: [{ name: plan.name, quantity: 1, value: plan.value }],
      installment: { maxInstallmentCount: 12 },
    };

    logStep("Creating Asaas checkout", checkoutPayload);

    const asaasResponse = await fetch(`${ASAAS_API_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasKey,
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text();
      logStep("Asaas API error", { status: asaasResponse.status, body: errorText });
      throw new Error(`Asaas API error: ${asaasResponse.status} - ${errorText}`);
    }

    const asaasData = await asaasResponse.json();
    logStep("Asaas checkout created", { id: asaasData.id });

    return new Response(JSON.stringify({ checkout_id: asaasData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
