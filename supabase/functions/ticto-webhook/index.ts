import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de produtos da Ticto para créditos
const PRODUCT_CREDITS: Record<string, number> = {
  'O7EB601F4': 50,   // Starter
  'O37CE7121': 120,  // Pro
  'OD5F04218': 400,  // Business
};

interface TictoPayload {
  event?: string;
  transaction?: {
    id: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
  customer?: {
    email: string;
    name?: string;
    document?: string;
  };
  product?: {
    id: string;
    name?: string;
  };
  // Campos alternativos que a Ticto pode enviar
  status?: string;
  order_id?: string;
  buyer_email?: string;
  product_id?: string;
  offer_code?: string;
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
  
  try {
    body = await req.json();
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('Erro ao parsear JSON:', e);
    await logWebhook(supabase, 'parse_error', {}, false, 'Failed to parse JSON body');
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  // Normalizar campos do payload (Ticto pode usar formatos diferentes)
  const eventType = body.event || body.status || 'unknown';
  const transactionId = body.transaction?.id || body.order_id || '';
  const customerEmail = body.customer?.email || body.buyer_email || '';
  const productId = body.product?.id || body.product_id || body.offer_code || '';
  const amountPaid = body.transaction?.amount || 0;

  // Validar se é um evento de aprovação
  const approvalEvents = ['APPROVED', 'Venda Realizada', 'approved', 'paid', 'confirmed'];
  const isApproved = approvalEvents.some(e => 
    eventType.toLowerCase().includes(e.toLowerCase())
  );

  if (!isApproved) {
    console.log(`Evento ignorado: ${eventType}`);
    await logWebhook(supabase, eventType, body, false, `Event type not approved: ${eventType}`);
    return new Response('Event ignored', { status: 200, headers: corsHeaders });
  }

  // Verificar campos obrigatórios
  if (!transactionId) {
    console.error('Transaction ID não encontrado');
    await logWebhook(supabase, eventType, body, false, 'Missing transaction_id');
    return new Response('Missing transaction_id', { status: 200, headers: corsHeaders });
  }

  if (!customerEmail) {
    console.error('Email do cliente não encontrado');
    await logWebhook(supabase, eventType, body, false, 'Missing customer email');
    return new Response('Missing customer email', { status: 200, headers: corsHeaders });
  }

  // Verificar duplicata
  const { data: existingPurchase } = await supabase
    .from('credit_purchases')
    .select('id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (existingPurchase) {
    console.log(`Transação já processada: ${transactionId}`);
    await logWebhook(supabase, eventType, body, true, 'Already processed');
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
    await logWebhook(supabase, eventType, body, false, `User not found: ${customerEmail}`);
    return new Response('User not found', { status: 200, headers: corsHeaders });
  }

  // Calcular créditos
  const credits = PRODUCT_CREDITS[productId] || 0;
  
  if (credits === 0) {
    console.error(`Produto desconhecido: ${productId}`);
    await logWebhook(supabase, eventType, body, false, `Unknown product: ${productId}`);
    return new Response('Unknown product', { status: 200, headers: corsHeaders });
  }

  // Adicionar créditos ao perfil
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: profile.credits + credits })
    .eq('user_id', profile.user_id);

  if (updateError) {
    console.error('Erro ao atualizar créditos:', updateError);
    await logWebhook(supabase, eventType, body, false, `Failed to update credits: ${updateError.message}`);
    return new Response('Failed to update credits', { status: 500, headers: corsHeaders });
  }

  // Registrar compra
  const { error: insertError } = await supabase
    .from('credit_purchases')
    .insert({
      user_id: profile.user_id,
      transaction_id: transactionId,
      product_id: productId,
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
  await logWebhook(supabase, eventType, body, true);

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
