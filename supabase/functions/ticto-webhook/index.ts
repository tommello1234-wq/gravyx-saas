import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de ofertas da Ticto para créditos (código da oferta -> créditos)
const OFFER_CREDITS: Record<string, number> = {
  'O7EB601F4': 50,   // Starter
  'O37CE7121': 120,  // Pro
  'OD5F04218': 400,  // Business
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
  const offerCode = body.query_params?.code || body.offer?.code || body.item?.offer_code || body.url_params?.query_params?.code || '';
  const amountPaid = body.order?.paid_amount || body.item?.amount || 0;

  // Verificar se é um evento de aprovação
  const approvalStatuses = ['approved', 'paid', 'confirmed', 'completed', 'authorized'];
  const isApproved = approvalStatuses.some(s => 
    status.toLowerCase().includes(s)
  );

  if (!isApproved) {
    console.log(`Evento ignorado: ${status}`);
    await logWebhook(supabase, status, body, false, `Status not approved: ${status}`);
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
  if (offerCode && !Object.keys(OFFER_CREDITS).includes(offerCode)) {
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

  // Buscar usuário por email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', customerEmail.toLowerCase().trim())
    .maybeSingle();

  if (profileError || !profile) {
    console.error(`Usuário não encontrado: ${customerEmail}`, profileError);
    await logWebhook(supabase, status, body, false, `User not found: ${customerEmail}`);
    return new Response('User not found', { status: 200, headers: corsHeaders });
  }

  // Credits already validated via early offer_code check above
  const credits = OFFER_CREDITS[offerCode] || 0;
  
  if (credits === 0) {
    console.error(`Oferta sem créditos mapeados: ${offerCode}`);
    await logWebhook(supabase, status, body, false, `No credits mapped for offer: ${offerCode}`);
    return new Response('Unknown offer', { status: 200, headers: corsHeaders });
  }

  // Adicionar créditos ao perfil
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: profile.credits + credits })
    .eq('user_id', profile.user_id);

  if (updateError) {
    console.error('Erro ao atualizar créditos:', updateError);
    await logWebhook(supabase, status, body, false, `Failed to update credits: ${updateError.message}`);
    return new Response('Failed to update credits', { status: 500, headers: corsHeaders });
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
