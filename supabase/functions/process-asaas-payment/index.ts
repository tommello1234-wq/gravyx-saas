import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[PROCESS-ASAAS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// ---------- pricing ----------
interface TierPricing {
  monthly: number;
  annual: number;
  monthlyCredits: number;
  annualCredits: number;
  maxProjects: number;
}

const PRICING: Record<string, TierPricing> = {
  starter:    { monthly: 79,  annual: 420,  monthlyCredits: 80,   annualCredits: 1000, maxProjects: 3  },
  premium:    { monthly: 167, annual: 1097, monthlyCredits: 250,  annualCredits: 3000, maxProjects: -1 },
  enterprise: { monthly: 347, annual: 2597, monthlyCredits: 600,  annualCredits: 7200, maxProjects: -1 },
};

const ASAAS_BASE = "https://api.asaas.com";

async function asaasRequest(path: string, method: string, body?: unknown) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured");

  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: apiKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) {
    log("Asaas API error", { status: res.status, path, data });
    throw new Error(data?.errors?.[0]?.description || `Asaas error ${res.status}`);
  }
  return data;
}

async function ensureCustomer(email: string, name: string, cpfCnpj: string): Promise<string> {
  const search = await asaasRequest(`/v3/customers?email=${encodeURIComponent(email)}`, "GET");
  if (search.data?.length > 0) return search.data[0].id;

  const created = await asaasRequest("/v3/customers", "POST", {
    name: name || email.split("@")[0],
    email,
    cpfCnpj: cpfCnpj.replace(/\D/g, ""),
  });
  return created.id;
}

// ---------- helpers ----------
function buildCreditCardFields(
  creditCard: Record<string, string>,
  creditCardHolderInfo: Record<string, string>,
  userEmail: string,
  remoteIp?: string
) {
  const fields: Record<string, unknown> = {
    creditCard: {
      holderName: creditCard.holderName,
      number: creditCard.number.replace(/\s/g, ""),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    },
    creditCardHolderInfo: {
      name: creditCardHolderInfo.name,
      email: userEmail,
      cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ""),
      postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ""),
      addressNumber: creditCardHolderInfo.addressNumber,
      phone: creditCardHolderInfo.phone.replace(/\D/g, ""),
    },
  };
  if (remoteIp) fields.remoteIp = remoteIp;
  return fields;
}

function nextDueDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// ===================== MAIN =====================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    // --- Parse & validate ---
    const body = await req.json();
    const { tier, cycle, paymentMethod, installmentCount, creditCard, creditCardHolderInfo, remoteIp } = body;

    const pricing = PRICING[tier];
    if (!pricing) return new Response(JSON.stringify({ error: "Invalid tier" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (cycle !== "monthly" && cycle !== "annual") return new Response(JSON.stringify({ error: "Invalid cycle" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (paymentMethod !== "PIX" && paymentMethod !== "CREDIT_CARD") return new Response(JSON.stringify({ error: "Invalid paymentMethod" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const totalValue = cycle === "monthly" ? pricing.monthly : pricing.annual;
    const credits = cycle === "monthly" ? pricing.monthlyCredits : pricing.annualCredits;
    const externalReference = `gravyx_${cycle}_${tier}_${userId}`;
    const cpfCnpj = creditCardHolderInfo?.cpfCnpj || body.cpfCnpj || "";
    const holderName = creditCardHolderInfo?.name || creditCard?.holderName || userEmail.split("@")[0];

    const customerId = await ensureCustomer(userEmail, holderName, cpfCnpj);
    log("Processing", { userId, tier, cycle, paymentMethod, totalValue });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const description = `GravyX ${tier.charAt(0).toUpperCase() + tier.slice(1)} - ${cycle === "monthly" ? "Mensal" : "Anual"}`;

    // ============================================================
    // CASE 1: Annual + Credit Card → one-off installable payment
    // ============================================================
    if (cycle === "annual" && paymentMethod === "CREDIT_CARD") {
      if (!creditCard || !creditCardHolderInfo) {
        return new Response(JSON.stringify({ error: "Card data required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const paymentPayload: Record<string, unknown> = {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: totalValue,
        dueDate: nextDueDateStr(),
        description,
        externalReference,
        notifications: { disabled: true },
        ...buildCreditCardFields(creditCard, creditCardHolderInfo, userEmail, remoteIp),
      };

      // Installments (2-12x) for annual card payments
      if (installmentCount && installmentCount >= 2 && installmentCount <= 12) {
        paymentPayload.installmentCount = installmentCount;
        paymentPayload.installmentValue = Math.ceil((totalValue / installmentCount) * 100) / 100;
      }

      const payment = await asaasRequest("/v3/payments", "POST", paymentPayload);
      log("Annual card payment created", { id: payment.id, status: payment.status });

      if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credits").eq("user_id", userId).maybeSingle();
        await supabaseAdmin.from("profiles").update({
          credits: (profile?.credits || 0) + credits,
          tier, billing_cycle: cycle, max_projects: pricing.maxProjects,
          subscription_status: "active", asaas_subscription_id: null,
        }).eq("user_id", userId);

        await supabaseAdmin.from("credit_purchases").insert({
          user_id: userId, transaction_id: payment.id,
          product_id: `asaas_${cycle}_${tier}`, credits_added: credits,
          amount_paid: totalValue * 100, customer_email: userEmail,
          raw_payload: { payment_id: payment.id, tier, cycle, method: "CREDIT_CARD", installments: installmentCount || 1 },
        });

        log("Annual plan activated via card", { userId, tier, credits });
        return new Response(JSON.stringify({ success: true, method: "CREDIT_CARD", status: "CONFIRMED", tier, credits }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: false, method: "CREDIT_CARD", status: payment.status,
        message: payment.status === "PENDING" ? "Pagamento pendente de confirmação" : "Pagamento não aprovado. Verifique os dados do cartão.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // CASE 2: Subscription (monthly card/pix, annual pix)
    // ============================================================
    const asaasCycle = cycle === "monthly" ? "MONTHLY" : "YEARLY";

    const subscriptionPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: paymentMethod === "PIX" ? "UNDEFINED" : "CREDIT_CARD",
      cycle: asaasCycle,
      value: totalValue,
      nextDueDate: nextDueDateStr(),
      description,
      externalReference,
      notifications: { disabled: true },
    };

    if (paymentMethod === "CREDIT_CARD") {
      if (!creditCard || !creditCardHolderInfo) {
        return new Response(JSON.stringify({ error: "Card data required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      Object.assign(subscriptionPayload, buildCreditCardFields(creditCard, creditCardHolderInfo, userEmail, remoteIp));
    }

    const subscription = await asaasRequest("/v3/subscriptions", "POST", subscriptionPayload);
    log("Subscription created", { id: subscription.id });

    // Save subscription ID
    await supabaseAdmin.from("profiles").update({ asaas_subscription_id: subscription.id }).eq("user_id", userId);

    // --- PIX: fetch first payment QR code ---
    if (paymentMethod === "PIX") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const payments = await asaasRequest(`/v3/subscriptions/${subscription.id}/payments`, "GET");
      if (!payments.data?.length) throw new Error("Nenhuma cobrança gerada. Tente novamente.");

      const firstPayment = payments.data[0];
      const pixData = await asaasRequest(`/v3/payments/${firstPayment.id}/pixQrCode`, "GET");
      log("PIX QR generated", { paymentId: firstPayment.id });

      return new Response(JSON.stringify({
        success: true, method: "PIX", paymentId: firstPayment.id,
        subscriptionId: subscription.id, pixQrCode: pixData.encodedImage,
        pixCopyPaste: pixData.payload, expirationDate: pixData.expirationDate, totalValue,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Monthly card: check first payment ---
    await new Promise(resolve => setTimeout(resolve, 2000));
    const payments = await asaasRequest(`/v3/subscriptions/${subscription.id}/payments`, "GET");
    const firstPayment = payments.data?.[0];

    if (firstPayment && (firstPayment.status === "CONFIRMED" || firstPayment.status === "RECEIVED")) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credits").eq("user_id", userId).maybeSingle();
      await supabaseAdmin.from("profiles").update({
        credits: (profile?.credits || 0) + credits,
        tier, billing_cycle: cycle, max_projects: pricing.maxProjects, subscription_status: "active",
      }).eq("user_id", userId);

      await supabaseAdmin.from("credit_purchases").insert({
        user_id: userId, transaction_id: firstPayment.id,
        product_id: `asaas_${cycle}_${tier}`, credits_added: credits,
          amount_paid: totalValue * 100, customer_email: userEmail,
          raw_payload: { subscription_id: subscription.id, payment_id: firstPayment.id, tier, cycle, method: "CREDIT_CARD" },
      });

      log("Plan activated via subscription card", { userId, tier, credits, subscriptionId: subscription.id });
      return new Response(JSON.stringify({
        success: true, method: "CREDIT_CARD", status: "CONFIRMED",
        subscriptionId: subscription.id, tier, credits,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: false, method: "CREDIT_CARD", status: firstPayment?.status || "UNKNOWN",
      subscriptionId: subscription.id,
      message: firstPayment?.status === "PENDING" ? "Pagamento pendente de confirmação" : "Pagamento não aprovado. Verifique os dados do cartão.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    log("Error", { message: (err as Error).message });
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
