import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PASSWORD = 'Gravyx@2025!';
const LOGIN_URL = 'https://app.gravyx.com.br';

// Mapeamento completo de ofertas Ticto -> config do plano
interface OfferConfig {
  credits: number;
  tier: string;
  billing_cycle: string;
  max_projects: number;
}

const OFFER_CONFIG: Record<string, OfferConfig> = {
  'O7A4C2615': { credits: 80,   tier: 'starter',    billing_cycle: 'monthly', max_projects: 3  },
  'OA871890B': { credits: 1000, tier: 'starter',    billing_cycle: 'annual',  max_projects: 3  },
  'O465B8044': { credits: 250,  tier: 'premium',    billing_cycle: 'monthly', max_projects: -1 },
  'O06B270AF': { credits: 3000, tier: 'premium',    billing_cycle: 'annual',  max_projects: -1 },
  'O8AA396EB': { credits: 600,  tier: 'enterprise', billing_cycle: 'monthly', max_projects: -1 },
  'OA8BDDA9B': { credits: 7200, tier: 'enterprise', billing_cycle: 'annual',  max_projects: -1 },
};

interface TictoPayload {
  status?: string;
  payment_method?: string;
  query_params?: {
    code?: string;
    offer_code?: string;
  };
  url_params?: {
    query_params?: {
      code?: string;
    };
  };
  offer?: {
    id?: number;
    code?: string;
    name?: string;
  };
  order?: {
    hash: string;
    paid_amount?: number;
    installments?: number;
  };
  item?: {
    product_name?: string;
    product_id?: number;
    offer_name?: string;
    offer_id?: number;
    offer_code?: string;
    amount?: number;
  };
  customer?: {
    email: string;
    name?: string;
    cpf?: string;
  };
  token?: string;
}

// === HELPER: criar conta e profile automaticamente ===
async function createAccountAndProfile(
  supabase: ReturnType<typeof createClient>,
  email: string,
  customerName?: string
): Promise<{ user_id: string; credits: number; tier: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`🔄 Auto-criando conta para: ${normalizedEmail}`);

  // 1. Criar usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: customerName || normalizedEmail.split('@')[0],
    },
  });

  if (authError) {
    console.error(`❌ Erro ao criar usuário auth: ${authError.message}`);
    return null;
  }

  const userId = authData.user.id;
  console.log(`✅ Usuário auth criado: ${userId}`);

  // 2. Aguardar o trigger handle_new_user criar o profile (retry com delay)
  let profile = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const { data } = await supabase
      .from('profiles')
      .select('user_id, credits, tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      profile = data;
      break;
    }
    console.log(`⏳ Aguardando profile... tentativa ${attempt + 1}/5`);
  }

  if (!profile) {
    console.error(`❌ Profile não foi criado pelo trigger para: ${userId}`);
    return null;
  }

  console.log(`✅ Profile encontrado para: ${normalizedEmail}`);

  // 3. Enviar email de boas-vindas com credenciais
  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
    const html = buildWelcomeCredentialsHtml(normalizedEmail, DEFAULT_PASSWORD, LOGIN_URL);

    const { error: emailError } = await resend.emails.send({
      from: 'Gravyx <noreply@upwardacademy.com.br>',
      to: [normalizedEmail],
      subject: 'Sua conta Gravyx foi criada! 🚀',
      html,
    });

    if (emailError) {
      console.error(`⚠️ Erro ao enviar email de credenciais:`, emailError);
    } else {
      console.log(`📧 Email de credenciais enviado para: ${normalizedEmail}`);
    }
  } catch (e) {
    console.error(`⚠️ Exceção ao enviar email:`, e);
  }

  return profile;
}

// === HELPER: buscar perfil por email, ou criar conta se não existir ===
async function findOrCreateProfile(
  supabase: ReturnType<typeof createClient>,
  email: string,
  customerName?: string,
  autoCreate = false
) {
  if (!email) return null;
  const { data } = await supabase
    .from('profiles')
    .select('user_id, credits, tier')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  
  if (data) return data;

  if (autoCreate) {
    return await createAccountAndProfile(supabase, email, customerName);
  }

  return null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let body: TictoPayload;
  
  // Check Content-Length header before reading body into memory
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 50000) {
    await logWebhook(supabase, 'payload_too_large', {}, false, 'Payload exceeds 50KB limit (Content-Length)');
    return new Response('Payload too large', { status: 413, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 50000) {
      await logWebhook(supabase, 'payload_too_large', {}, false, 'Payload exceeds 50KB limit');
      return new Response('Payload too large', { status: 413, headers: corsHeaders });
    }
    body = JSON.parse(rawBody);
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('Erro ao parsear JSON:', e);
    await logWebhook(supabase, 'parse_error', {}, false, 'Failed to parse JSON body');
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  // Validate required structure
  if (!body || typeof body !== 'object') {
    await logWebhook(supabase, 'invalid_payload', {}, false, 'Payload must be a JSON object');
    return new Response('Invalid payload', { status: 400, headers: corsHeaders });
  }

  // Validar token de segurança
  const expectedToken = Deno.env.get('TICTO_WEBHOOK_TOKEN');
  if (!expectedToken) {
    console.error('TICTO_WEBHOOK_TOKEN not configured');
    await logWebhook(supabase, 'missing_token', {}, false, 'TICTO_WEBHOOK_TOKEN not configured');
    return new Response('Server misconfiguration', { status: 500, headers: corsHeaders });
  }
  if (body.token !== expectedToken) {
    console.error('Token inválido');
    await logWebhook(supabase, 'invalid_token', body, false, 'Invalid webhook token');
    return new Response('Invalid token', { status: 401, headers: corsHeaders });
  }

  // Extrair campos do payload real da Ticto
  const status = body.status || '';
  const transactionId = body.order?.hash || '';
  const customerEmail = body.customer?.email || '';
  const customerName = body.customer?.name;
  const offerCode = body.query_params?.code || body.offer?.code || body.item?.offer_code || body.url_params?.query_params?.code || '';
  const amountPaid = body.order?.paid_amount || body.item?.amount || 0;

  // === HELPER: buscar perfil por email (sem auto-criar) ===
  async function findProfile(email: string) {
    if (!email) return null;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, credits, tier')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    return data;
  }

  // === HELPER: downgrade para Free ===
  async function downgradeToFree(userId: string, currentCredits: number, creditsToRemove: number) {
    return supabase.from('profiles').update({
      credits: Math.max(0, currentCredits - creditsToRemove),
      tier: 'free',
      billing_cycle: 'monthly',
      max_projects: 1,
      subscription_status: 'inactive',
    }).eq('user_id', userId);
  }

  const statusLower = status.toLowerCase();

  // 1. REEMBOLSO / CHARGEBACK → reverte tudo, volta pro Free
  const refundStatuses = ['refunded', 'reembolso', 'chargeback', 'chargedback', 'disputed'];
  const isRefund = refundStatuses.some(s => statusLower.includes(s));

  if (isRefund) {
    const profile = await findProfile(customerEmail);
    if (!profile) {
      await logWebhook(supabase, status, body, false, `Refund: user not found: ${customerEmail}`);
      return new Response('User not found', { status: 200, headers: corsHeaders });
    }

    // Buscar créditos da compra original para reverter
    let creditsToRemove = 0;
    if (transactionId) {
      const { data: purchase } = await supabase
        .from('credit_purchases')
        .select('credits_added')
        .eq('transaction_id', transactionId)
        .maybeSingle();
      creditsToRemove = purchase?.credits_added || 0;
    }

    const { error } = await downgradeToFree(profile.user_id, profile.credits, creditsToRemove);
    if (error) {
      await logWebhook(supabase, status, body, false, `Refund failed: ${error.message}`);
      return new Response('Refund failed', { status: 500, headers: corsHeaders });
    }

    console.log(`🔄 Reembolso/Chargeback: ${customerEmail} → Free (−${creditsToRemove} créditos)`);
    await logWebhook(supabase, status, body, true);
    return new Response(JSON.stringify({ success: true, action: 'refund' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. ASSINATURA ENCERRADA (todas cobranças finalizadas) → downgrade para Free
  if (statusLower.includes('encerrada') || statusLower.includes('subscription_ended')) {
    const profile = await findProfile(customerEmail);
    if (!profile) {
      await logWebhook(supabase, status, body, false, `Encerrada: user not found: ${customerEmail}`);
      return new Response('User not found', { status: 200, headers: corsHeaders });
    }

    const { error } = await downgradeToFree(profile.user_id, profile.credits, 0);
    if (error) {
      await logWebhook(supabase, status, body, false, `Encerrada failed: ${error.message}`);
      return new Response('Failed', { status: 500, headers: corsHeaders });
    }

    console.log(`⏹️ Assinatura encerrada: ${customerEmail} → Free`);
    await logWebhook(supabase, status, body, true);
    return new Response(JSON.stringify({ success: true, action: 'subscription_ended' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. CANCELADA → downgrade imediato
  if (statusLower.includes('cancelada') || statusLower.includes('cancelled') || statusLower.includes('canceled')) {
    const profile = await findProfile(customerEmail);

    if (profile) {
      await downgradeToFree(profile.user_id, profile.credits, 0);
      console.log(`🔻 Assinatura cancelada - downgrade: ${customerEmail}`);
      await logWebhook(supabase, status, body, true, 'Subscription cancelled - downgraded to Free');
      return new Response(JSON.stringify({ success: true, action: 'cancelled_downgraded' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`⚠️ Cancelamento para usuário não encontrado: ${customerEmail}`);
    await logWebhook(supabase, status, body, false, `Cancel: user not found: ${customerEmail}`);
    return new Response(JSON.stringify({ success: true, action: 'cancelled_user_not_found' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 4. ATRASADA → loga como alerta, mas não altera nada ainda
  if (statusLower.includes('atrasada') || statusLower.includes('overdue') || statusLower.includes('past_due')) {
    console.log(`⚠️ Assinatura atrasada: ${customerEmail}`);
    await logWebhook(supabase, status, body, true, 'Payment overdue - logged');
    return new Response(JSON.stringify({ success: true, action: 'overdue_logged' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 5-7. RETOMADA / PLANO ALTERADO / EXTENDIDA → cai no fluxo de aprovação abaixo

  // 8. PERÍODO DE TESTES / TRIAL (legado) → tratar como ativação imediata do plano
  const trialStatuses = ['periodo de testes', 'trial'];
  const isTrial = trialStatuses.some(s => statusLower.includes(s));
  if (isTrial) {
    // Trial não existe mais - redirecionar para o fluxo de aprovação normal
    console.log(`ℹ️ Evento de trial recebido, tratando como ativação imediata: ${customerEmail}`);
    // Não retornamos aqui, deixamos cair no fluxo de aprovação abaixo
  }

  // 8b. CARTÃO ATUALIZADO → apenas loga
  const infoOnlyStatuses = ['cartao', 'card_updated'];
  const isInfoOnly = infoOnlyStatuses.some(s => statusLower.includes(s));
  if (isInfoOnly) {
    console.log(`ℹ️ Evento informativo: ${status}`);
    await logWebhook(supabase, status, body, true, 'Info event logged');
    return new Response(JSON.stringify({ success: true, action: 'info_logged' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 9. APROVAÇÃO / VENDA / RENOVAÇÃO / RETOMADA / PLANO ALTERADO → adiciona créditos + atualiza tier
  const approvalStatuses = ['approved', 'paid', 'confirmed', 'completed', 'authorized',
    'venda realizada', 'retomada', 'resumed', 'plano alterado', 'plan_changed', 'extendida', 'extended'];
  const isApproved = approvalStatuses.some(s => statusLower.includes(s));

  if (!isApproved) {
    console.log(`Evento ignorado: ${status}`);
    await logWebhook(supabase, status, body, false, `Status not handled: ${status}`);
    return new Response('Event ignored', { status: 200, headers: corsHeaders });
  }

  // Verificar campos obrigatórios
  if (!transactionId || typeof transactionId !== 'string' || transactionId.length > 255) {
    console.error('Transaction ID inválido ou não encontrado');
    await logWebhook(supabase, status, body, false, 'Missing or invalid transaction_id (order.hash)');
    return new Response('Missing transaction_id', { status: 200, headers: corsHeaders });
  }

  if (!customerEmail) {
    console.error('Email do cliente não encontrado');
    await logWebhook(supabase, status, body, false, 'Missing customer email');
    return new Response('Missing customer email', { status: 200, headers: corsHeaders });
  }

  // Validate offer_code against known offers before processing
  if (offerCode && !Object.keys(OFFER_CONFIG).includes(offerCode)) {
    console.error(`Oferta desconhecida: ${offerCode}`);
    await logWebhook(supabase, status, body, false, `Unknown offer code: ${offerCode}`);
    return new Response('Unknown offer', { status: 200, headers: corsHeaders });
  }

  // Validate amount_paid is reasonable
  if (amountPaid !== 0 && (typeof amountPaid !== 'number' || amountPaid < 0 || amountPaid > 100000)) {
    console.error('Valor pago inválido');
    await logWebhook(supabase, status, body, false, `Invalid amount_paid: ${amountPaid}`);
    return new Response('Invalid amount', { status: 200, headers: corsHeaders });
  }

  // Verificar duplicata
  const { data: existingPurchase } = await supabase
    .from('credit_purchases')
    .select('id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (existingPurchase) {
    console.log(`Transação já processada: ${transactionId}`);
    await logWebhook(supabase, status, body, true, 'Already processed');
    return new Response('Already processed', { status: 200, headers: corsHeaders });
  }

  // Buscar usuário por email (auto-cria conta se não existir)
  const profile = await findOrCreateProfile(supabase, customerEmail, customerName, true);

  if (!profile) {
    console.error(`Falha ao encontrar/criar usuário: ${customerEmail}`);
    await logWebhook(supabase, status, body, false, `Failed to find or create user: ${customerEmail}`);
    return new Response('User creation failed', { status: 200, headers: corsHeaders });
  }

  // Config da oferta (já validada acima)
  const config = OFFER_CONFIG[offerCode];
  
  if (!config) {
    console.error(`Oferta sem config mapeada: ${offerCode}`);
    await logWebhook(supabase, status, body, false, `No config mapped for offer: ${offerCode}`);
    return new Response('Unknown offer', { status: 200, headers: corsHeaders });
  }

  const { credits, tier, billing_cycle, max_projects } = config;

  // Atualizar perfil: créditos + tier + billing_cycle + max_projects + subscription_status
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      credits: profile.credits + credits,
      tier,
      billing_cycle,
      max_projects,
      subscription_status: 'active',
    }).eq('user_id', profile.user_id);

  if (updateError) {
    console.error('Erro ao atualizar créditos:', updateError);
    await logWebhook(supabase, status, body, false, `Failed to update credits: ${updateError.message}`);
    return new Response('Processing failed', { status: 500, headers: corsHeaders });
  }

  // Registrar compra
  const { error: insertError } = await supabase
    .from('credit_purchases')
    .insert({
      user_id: profile.user_id,
      transaction_id: transactionId,
      product_id: offerCode,
      credits_added: credits,
      amount_paid: amountPaid,
      customer_email: customerEmail.toLowerCase().trim(),
      raw_payload: body
    });

  if (insertError) {
    console.error('Erro ao registrar compra:', insertError);
    // Não falhar aqui, créditos já foram adicionados
  }

  console.log(`✅ ${credits} créditos adicionados para ${customerEmail} (${profile.user_id})`);
  await logWebhook(supabase, status, body, true);

  return new Response(
    JSON.stringify({ 
      success: true, 
      credits_added: credits,
      user_email: customerEmail 
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  payload: unknown,
  processed: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from('webhook_logs').insert({
      event_type: `ticto:${eventType}`,
      payload: payload as Record<string, unknown>,
      processed,
      error_message: errorMessage || null
    });
  } catch (e) {
    console.error('Erro ao salvar log:', e);
  }
}

function buildWelcomeCredentialsHtml(email: string, password: string, loginUrl: string): string {
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
