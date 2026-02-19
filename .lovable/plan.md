

## Corrigir cancelamento de trial e erro de build

### Problema 1: Cancelamento durante trial nao faz downgrade

Quando um usuario cancela durante o periodo de teste (trial), o webhook da Ticto envia `subscription_canceled`. O codigo atual apenas loga o evento e mantem todos os beneficios, assumindo que o usuario pagou e deve manter acesso ate o fim do ciclo. Porem, quem esta em trial nunca pagou -- deveria perder o acesso imediatamente.

**Caso real:** `eddyaresd@gmail.com` entrou em trial as 16:35, cancelou as 18:14, e continua com `tier: premium` e `subscription_status: trial_active`.

### Solucao

No handler de cancelamento em `supabase/functions/ticto-webhook/index.ts` (linha ~295), verificar se o usuario esta em trial (`subscription_status = 'trial_active'`). Se sim, fazer downgrade imediato para Free. Se nao (assinatura paga), manter o comportamento atual (logar e manter beneficios ate fim do ciclo).

### Alteracao tecnica

**Arquivo:** `supabase/functions/ticto-webhook/index.ts`

Na secao de cancelamento (~linha 295), antes de apenas logar:

```
if (statusLower.includes('cancelada') || statusLower.includes('cancelled') || statusLower.includes('canceled')) {
  const profile = await findProfile(customerEmail);
  
  if (profile) {
    // Verificar se esta em trial - se sim, downgrade imediato
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('user_id', profile.user_id)
      .single();
    
    if (currentProfile?.subscription_status === 'trial_active') {
      // Trial cancelado = downgrade imediato (nunca pagou)
      await downgradeToFree(profile.user_id, profile.credits, profile.credits);
      console.log(`Trial cancelado - downgrade imediato: ${customerEmail}`);
      await logWebhook(supabase, status, body, true, 'Trial cancelled - immediate downgrade to Free');
      return new Response(JSON.stringify({ success: true, action: 'trial_cancelled_downgraded' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  
  // Assinatura paga cancelada - manter beneficios ate fim do ciclo
  console.log(`Assinatura cancelada (mantem beneficios): ${customerEmail}`);
  await logWebhook(supabase, status, body, true, 'Subscription cancelled - benefits kept until cycle end');
  return new Response(JSON.stringify({ success: true, action: 'cancelled_logged' }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### Problema 2: Erro de build no send-auth-email

O import `npm:@react-email/components@0.0.22` esta causando erro de typecheck. Trocar para importacao via esm.sh que funciona melhor no Deno.

**Arquivo:** `supabase/functions/send-auth-email/index.ts` (linha 4)

Trocar:
```
import { renderAsync } from 'npm:@react-email/components@0.0.22'
```
Por:
```
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22'
```

### Correcao manual do usuario eddyaresd

Apos o deploy, o usuario `eddyaresd@gmail.com` ja estara com status errado no banco. Sera necessario corrigir manualmente via SQL ou eu posso corrigir diretamente apos aplicar o fix.

### Impacto
- 2 arquivos modificados
- Sem alteracao no banco de dados (apenas dados do usuario especifico)
- Trials cancelados agora fazem downgrade imediato
- Assinaturas pagas canceladas continuam mantendo beneficios ate fim do ciclo
