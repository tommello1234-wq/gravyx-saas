import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[PROCESS-ASAAS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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

// ---------- Fetch pricing from DB ----------
async function fetchPricing(supabaseAdmin: ReturnType<typeof createClient>, tier: string, cycle: string) {
  const { data, error } = await supabaseAdmin
    .from("plan_pricing")
    .select("*")
    .eq("tier", tier)
    .eq("cycle", cycle)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch pricing: ${error.message}`);
  if (!data) throw new Error(`No pricing found for ${tier}/${cycle}`);
  return data as { price: number; credits: number; max_projects: number };
}

// ---------- Validate coupon ----------
async function validateCoupon(
  supabaseAdmin: ReturnType<typeof createClient>,
  code: string,
  tier: string,
  cycle: string,
  userId: string
): Promise<{ valid: true; couponId: string; discount_type: string; discount_value: number } | { valid: false; reason: string }> {
  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .maybeSingle();
  if (error || !coupon) return { valid: false, reason: "Cupom não encontrado" };
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { valid: false, reason: "Cupom expirado" };
  if (coupon.max_uses != null && coupon.current_uses >= coupon.max_uses) return { valid: false, reason: "Cupom esgotado" };
  if (coupon.allowed_tiers && !coupon.allowed_tiers.includes(tier)) return { valid: false, reason: "Cupom não válido para este plano" };
  if (coupon.allowed_cycles && !coupon.allowed_cycles.includes(cycle)) return { valid: false, reason: "Cupom não válido para este ciclo" };

  // Check if user already used this coupon
  const { data: usage } = await supabaseAdmin
    .from("coupon_usages")
    .select("id")
    .eq("coupon_id", coupon.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (usage) return { valid: false, reason: "Cupom já utilizado" };

  return { valid: true, couponId: coupon.id, discount_type: coupon.discount_type, discount_value: coupon.discount_value };
}

function applyDiscount(priceReais: number, discountType: string, discountValue: number): number {
  if (discountType === "percent") {
    return Math.max(priceReais * (1 - discountValue / 100), 0);
  }
  // fixed: discount_value is in centavos
  return Math.max(priceReais - discountValue / 100, 0);
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
    const { tier, cycle, paymentMethod, installmentCount, creditCard, creditCardHolderInfo, remoteIp, couponCode, oneOff } = body;

    if (cycle !== "monthly" && cycle !== "annual") return new Response(JSON.stringify({ error: "Invalid cycle" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (paymentMethod !== "PIX" && paymentMethod !== "CREDIT_CARD") return new Response(JSON.stringify({ error: "Invalid paymentMethod" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- Guard: block if user already has an active paid subscription (skip for one-off) ---
    if (!oneOff) {
      const { data: currentProfile } = await supabaseAdmin
        .from("profiles")
        .select("tier, subscription_status, asaas_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (currentProfile && currentProfile.subscription_status === "active" && currentProfile.tier !== "free") {
        log("Blocked duplicate subscription", { userId, currentTier: currentProfile.tier });
        return new Response(JSON.stringify({
          error: "Você já possui um plano ativo. Cancele o plano atual antes de assinar outro.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ============================================================
    // CASE 3: One-off credit package purchase
    // ============================================================
    if (oneOff) {
      const priceReais = body.price || 0;
      const creditsToAdd = body.credits || 0;
      const cpfCnpj = creditCardHolderInfo?.cpfCnpj || body.cpfCnpj || "";
      const holderName = creditCardHolderInfo?.name || creditCard?.holderName || userEmail.split("@")[0];
      const customerId = await ensureCustomer(userEmail, holderName, cpfCnpj);

      log("Processing one-off purchase", { userId, priceReais, creditsToAdd, paymentMethod });

      const description = `GravyX - Pacote avulso de ${creditsToAdd} créditos`;
      const externalReference = `gravyx_oneoff_${userId}_${Date.now()}`;

      if (paymentMethod === "PIX") {
        // Create single PIX payment
        const payment = await asaasRequest("/v3/payments", "POST", {
          customer: customerId,
          billingType: "PIX",
          value: priceReais,
          dueDate: nextDueDateStr(),
          description,
          externalReference,
          notifications: { disabled: true },
        });
        log("One-off PIX payment created", { id: payment.id });

        const pixData = await asaasRequest(`/v3/payments/${payment.id}/pixQrCode`, "GET");

        return new Response(JSON.stringify({
          success: true, method: "PIX", paymentId: payment.id,
          pixQrCode: pixData.encodedImage, pixCopyPaste: pixData.payload,
          expirationDate: pixData.expirationDate, totalValue: priceReais,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Credit card one-off
      if (!creditCard || !creditCardHolderInfo) {
        return new Response(JSON.stringify({ error: "Card data required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const payment = await asaasRequest("/v3/payments", "POST", {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: priceReais,
        dueDate: nextDueDateStr(),
        description,
        externalReference,
        notifications: { disabled: true },
        ...buildCreditCardFields(creditCard, creditCardHolderInfo, userEmail, remoteIp),
      });
      log("One-off card payment created", { id: payment.id, status: payment.status });

      if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
        // Add credits without changing tier/subscription
        await supabaseAdmin.rpc("increment_credits", { uid: userId, amount: creditsToAdd });

        await supabaseAdmin.from("credit_purchases").insert({
          user_id: userId, transaction_id: payment.id,
          product_id: `asaas_oneoff_${creditsToAdd}`, credits_added: creditsToAdd,
          amount_paid: Math.round(priceReais * 100), customer_email: userEmail,
          raw_payload: { payment_id: payment.id, oneOff: true, credits: creditsToAdd, method: "CREDIT_CARD" },
        });

        log("One-off credits added", { userId, creditsToAdd });
        return new Response(JSON.stringify({ success: true, method: "CREDIT_CARD", status: "CONFIRMED", credits: creditsToAdd }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: false, method: "CREDIT_CARD", status: payment.status,
        message: "Pagamento não aprovado. Verifique os dados do cartão.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch pricing from DB
    const pricing = await fetchPricing(supabaseAdmin, tier, cycle);
    const priceReais = pricing.price / 100; // centavos to reais
    const credits = pricing.credits;
    const maxProjects = pricing.max_projects;

    // Validate coupon if provided
    let finalValue = priceReais;
    let couponId: string | null = null;
    if (couponCode) {
      const result = await validateCoupon(supabaseAdmin, couponCode, tier, cycle, userId);
      if (!result.valid) {
        return new Response(JSON.stringify({ error: result.reason }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      finalValue = applyDiscount(priceReais, result.discount_type, result.discount_value);
      finalValue = Math.round(finalValue * 100) / 100;
      couponId = result.couponId;
      log("Coupon applied", { code: couponCode, original: priceReais, final: finalValue });
    }

    const externalReference = `gravyx_${cycle}_${tier}_${userId}`;
    const cpfCnpj = creditCardHolderInfo?.cpfCnpj || body.cpfCnpj || "";
    const holderName = creditCardHolderInfo?.name || creditCard?.holderName || userEmail.split("@")[0];

    const customerId = await ensureCustomer(userEmail, holderName, cpfCnpj);
    log("Processing", { userId, tier, cycle, paymentMethod, finalValue, originalValue: priceReais });

    const description = `GravyX ${tier.charAt(0).toUpperCase() + tier.slice(1)} - ${cycle === "monthly" ? "Mensal" : "Anual"}`;

    // Helper to record coupon usage
    const recordCouponUsage = async () => {
      if (couponId) {
        await supabaseAdmin.from("coupon_usages").insert({ coupon_id: couponId, user_id: userId });
        await supabaseAdmin.rpc("increment_coupon_uses" as never, { coupon_id: couponId } as never).then(() => {}).catch(() => {
          // fallback: direct update
          supabaseAdmin.from("coupons").update({ current_uses: undefined as never }).eq("id", couponId!);
        });
        // Direct increment
        const { data: couponData } = await supabaseAdmin.from("coupons").select("current_uses").eq("id", couponId).maybeSingle();
        if (couponData) {
          await supabaseAdmin.from("coupons").update({ current_uses: couponData.current_uses + 1 }).eq("id", couponId);
        }
      }
    };

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
        value: finalValue,
        dueDate: nextDueDateStr(),
        description,
        externalReference,
        notifications: { disabled: true },
        ...buildCreditCardFields(creditCard, creditCardHolderInfo, userEmail, remoteIp),
      };

      if (installmentCount && installmentCount >= 2 && installmentCount <= 12) {
        paymentPayload.installmentCount = installmentCount;
        paymentPayload.installmentValue = Math.ceil((finalValue / installmentCount) * 100) / 100;
      }

      const payment = await asaasRequest("/v3/payments", "POST", paymentPayload);
      log("Annual card payment created", { id: payment.id, status: payment.status });

      if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
        const { data: profile } = await supabaseAdmin.from("profiles").select("credits").eq("user_id", userId).maybeSingle();
        await supabaseAdmin.from("profiles").update({
          credits: (profile?.credits || 0) + credits,
          tier, billing_cycle: cycle, max_projects: maxProjects,
          subscription_status: "active", asaas_subscription_id: null,
        }).eq("user_id", userId);

        await supabaseAdmin.from("credit_purchases").insert({
          user_id: userId, transaction_id: payment.id,
          product_id: `asaas_${cycle}_${tier}`, credits_added: credits,
          amount_paid: Math.round(finalValue * 100), customer_email: userEmail,
          raw_payload: { payment_id: payment.id, tier, cycle, method: "CREDIT_CARD", installments: installmentCount || 1, coupon: couponCode || null },
        });

        await recordCouponUsage();

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
      value: priceReais, // Always full price — coupon discount applied only to first payment
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

    await supabaseAdmin.from("profiles").update({ asaas_subscription_id: subscription.id }).eq("user_id", userId);

    // --- PIX: fetch first payment QR code ---
    if (paymentMethod === "PIX") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const payments = await asaasRequest(`/v3/subscriptions/${subscription.id}/payments`, "GET");
      if (!payments.data?.length) throw new Error("Nenhuma cobrança gerada. Tente novamente.");

      const firstPayment = payments.data[0];

      // Apply coupon discount only to the first payment
      if (couponId && finalValue < priceReais) {
        await asaasRequest(`/v3/payments/${firstPayment.id}`, "PUT", { value: finalValue });
        log("Coupon discount applied to first PIX payment", { paymentId: firstPayment.id, original: priceReais, discounted: finalValue });
      }

      const pixData = await asaasRequest(`/v3/payments/${firstPayment.id}/pixQrCode`, "GET");
      log("PIX QR generated", { paymentId: firstPayment.id });

      // Record coupon usage for PIX (will be confirmed via webhook)
      await recordCouponUsage();

      return new Response(JSON.stringify({
        success: true, method: "PIX", paymentId: firstPayment.id,
        subscriptionId: subscription.id, pixQrCode: pixData.encodedImage,
        pixCopyPaste: pixData.payload, expirationDate: pixData.expirationDate, totalValue: finalValue,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Monthly card: check first payment ---
    await new Promise(resolve => setTimeout(resolve, 2000));
    const payments = await asaasRequest(`/v3/subscriptions/${subscription.id}/payments`, "GET");
    const firstPayment = payments.data?.[0];

    // Apply coupon discount only to the first payment (card)
    if (firstPayment && couponId && finalValue < priceReais) {
      await asaasRequest(`/v3/payments/${firstPayment.id}`, "PUT", { value: finalValue });
      log("Coupon discount applied to first card payment", { paymentId: firstPayment.id, original: priceReais, discounted: finalValue });
    }

    if (firstPayment && (firstPayment.status === "CONFIRMED" || firstPayment.status === "RECEIVED")) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credits").eq("user_id", userId).maybeSingle();
      await supabaseAdmin.from("profiles").update({
        credits: (profile?.credits || 0) + credits,
        tier, billing_cycle: cycle, max_projects: maxProjects, subscription_status: "active",
      }).eq("user_id", userId);

      await supabaseAdmin.from("credit_purchases").insert({
        user_id: userId, transaction_id: firstPayment.id,
        product_id: `asaas_${cycle}_${tier}`, credits_added: credits,
        amount_paid: Math.round(finalValue * 100), customer_email: userEmail,
        raw_payload: { subscription_id: subscription.id, payment_id: firstPayment.id, tier, cycle, method: "CREDIT_CARD", coupon: couponCode || null },
      });

      await recordCouponUsage();

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
