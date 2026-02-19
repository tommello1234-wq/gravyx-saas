

## Correcao: Bloquear Trials Duplicados no Webhook Ticto

### Problema
A Ticto envia multiplos webhooks de "periodo de testes" para o mesmo usuario. O codigo atual reseta os creditos para 5 a cada evento, permitindo que o usuario consuma creditos e receba mais. No caso do `dagagdfagad@gmail.com`, foram 5 webhooks em 40 minutos, resultando em 11 imagens geradas.

### Solucao
Adicionar uma verificacao no handler de trial: se o usuario ja tem `subscription_status = 'trial_active'` ou `'active'`, ignorar o webhook duplicado e logar.

### Alteracao

**Arquivo:** `supabase/functions/ticto-webhook/index.ts`

Na secao de tratamento de trial (linha ~329), apos encontrar/criar o profile e antes de ativar o trial, adicionar:

```typescript
// Verificar se ja esta em trial ou ativo - ignorar duplicata
const { data: currentProfile } = await supabase
  .from('profiles')
  .select('subscription_status')
  .eq('user_id', profile.user_id)
  .single();

if (currentProfile?.subscription_status === 'trial_active' || 
    currentProfile?.subscription_status === 'active') {
  console.log(`Trial duplicado ignorado: ${customerEmail} ja esta ${currentProfile.subscription_status}`);
  await logWebhook(supabase, status, body, true, `Trial duplicate ignored - already ${currentProfile.subscription_status}`);
  return new Response(JSON.stringify({ success: true, action: 'trial_duplicate_ignored' }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### Impacto
- 1 arquivo modificado
- Sem alteracao no banco de dados
- Webhooks duplicados de trial serao logados e ignorados
- Novos trials continuam funcionando normalmente

