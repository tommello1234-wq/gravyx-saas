import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validate JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    // Check admin role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle()
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { transactionId, targetUserId } = await req.json()
    if (!transactionId || !targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing transactionId or targetUserId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const isAsaas = transactionId.startsWith('pay_')
    let refundResult = null

    // Refund via Asaas API
    if (isAsaas) {
      const asaasApiKey = Deno.env.get('ASAAS_API_KEY')
      if (!asaasApiKey) {
        return new Response(JSON.stringify({ error: 'ASAAS_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      console.log('Calling Asaas refund API for payment:', transactionId)
      const refundResponse = await fetch(`https://api.asaas.com/v3/payments/${transactionId}/refund`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json',
        },
      })

      const responseText = await refundResponse.text()
      console.log('Asaas refund response status:', refundResponse.status)
      console.log('Asaas refund response body:', responseText)

      try {
        refundResult = JSON.parse(responseText)
      } catch {
        refundResult = { raw: responseText }
      }

      if (!refundResponse.ok) {
        // Log the error
        await supabaseAdmin.from('webhook_logs').insert({
          event_type: 'admin_refund_error',
          payload: { transactionId, targetUserId, status: refundResponse.status, error: refundResult },
          processed: false,
          error_message: responseText,
        })
        return new Response(JSON.stringify({ error: 'Falha no reembolso via Asaas', details: refundResult }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Downgrade user profile
    const { error: updateError } = await supabaseAdmin.from('profiles').update({
      tier: 'free',
      credits: 0,
      subscription_status: 'inactive',
      asaas_subscription_id: null,
    }).eq('user_id', targetUserId)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Falha ao fazer downgrade do usuário', details: updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log success
    await supabaseAdmin.from('webhook_logs').insert({
      event_type: 'admin_refund_success',
      payload: { transactionId, targetUserId, gateway: isAsaas ? 'asaas' : 'ticto', refundResult },
      processed: true,
    })

    return new Response(JSON.stringify({
      success: true,
      gateway: isAsaas ? 'asaas' : 'ticto',
      message: isAsaas
        ? 'Reembolso processado e usuário rebaixado para Free'
        : 'Usuário rebaixado para Free. Estorne manualmente no painel da Ticto.',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
