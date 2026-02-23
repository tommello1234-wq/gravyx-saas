

## Migrar para Assinaturas Recorrentes no Asaas

### O que muda

Atualmente o sistema cria uma **cobranca avulsa** (`/v3/payments`) cada vez que o usuario paga. Isso significa que o plano nao renova automaticamente -- o usuario teria que comprar de novo todo mes/ano.

A proposta e migrar para o endpoint **`/v3/subscriptions`** do Asaas, que cria assinaturas recorrentes reais com cobranca automatica.

### Como vai funcionar para o usuario

1. Seleciona plano e ciclo (mensal/anual)
2. Paga via PIX ou cartao (mesmo fluxo visual atual)
3. Assinatura fica ativa no Asaas -- cobrada automaticamente no proximo ciclo
4. Creditos renovados a cada pagamento confirmado via webhook
5. Pode cancelar a qualquer momento

### Arquivos a modificar

**1. `supabase/functions/process-asaas-payment/index.ts`**
- Substituir chamada `/v3/payments` por `/v3/subscriptions`
- Parametros da subscription:
  - `cycle`: `MONTHLY` ou `YEARLY`
  - `billingType`: `PIX` ou `CREDIT_CARD`
  - `value`: preco mensal (para anual, o Asaas calcula automaticamente)
  - `nextDueDate`: data do primeiro vencimento (amanha)
  - `externalReference`: `gravyx_{cycle}_{tier}_{userId}`
  - `creditCard` e `creditCardHolderInfo` (para cartao)
- Para PIX: apos criar subscription, buscar a primeira cobranca gerada e obter QR Code dela
- Para cartao: a primeira cobranca e processada na hora; se confirmada, ativar plano
- Retornar `subscriptionId` para salvar no perfil do usuario

**2. `supabase/functions/asaas-webhook/index.ts`**
- Ja trata `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED` -- continua funcionando
- Adicionar tratamento de eventos de subscription: `PAYMENT_CREATED` (para buscar QR Code de renovacao PIX)
- A cada pagamento confirmado de uma assinatura, renovar creditos do usuario (ja faz isso)
- Nenhuma mudanca grande necessaria, pois o webhook do Asaas envia os mesmos eventos de pagamento para subscriptions

**3. Migracao de banco de dados**
- Adicionar coluna `asaas_subscription_id` (text, nullable) na tabela `profiles`
- Usado para cancelar/gerenciar a assinatura futuramente

**4. `src/components/AsaasTransparentCheckout.tsx`**
- Nenhuma mudanca visual -- o formulario continua identico
- Apenas salvar o `subscriptionId` retornado pela Edge Function no perfil (via resposta da API)

**5. `src/components/BuyCreditsModal.tsx`**
- Sem mudancas visuais

### Detalhes tecnicos

Payload para criar subscription no Asaas:
```text
POST /v3/subscriptions
{
  "customer": "cus_xxx",
  "billingType": "CREDIT_CARD" | "PIX" | "UNDEFINED",
  "cycle": "MONTHLY" | "YEARLY",
  "value": 79.00,
  "nextDueDate": "2026-02-24",
  "description": "GravyX Starter - Mensal",
  "externalReference": "gravyx_monthly_starter_{userId}",
  "creditCard": { ... },
  "creditCardHolderInfo": { ... }
}
```

Para PIX na subscription:
- Criar subscription com `billingType: "UNDEFINED"` ou `"PIX"`
- Listar pagamentos da subscription via `/v3/subscriptions/{id}/payments`
- Pegar o primeiro pagamento e gerar QR Code via `/v3/payments/{paymentId}/pixQrCode`
- Polling no frontend continua igual (verifica `credit_purchases`)

Fluxo de renovacao automatica:
- Asaas gera nova cobranca automaticamente no vencimento
- Webhook recebe `PAYMENT_CONFIRMED` com o `externalReference`
- Webhook adiciona creditos e mantem plano ativo
- Se pagamento falhar, webhook recebe `PAYMENT_OVERDUE` e pode marcar subscription_status como "past_due"

### Resumo das mudancas

| Arquivo | Tipo | O que muda |
|---------|------|------------|
| `process-asaas-payment/index.ts` | Modificar | `/v3/payments` vira `/v3/subscriptions` |
| `asaas-webhook/index.ts` | Modificar | Salvar subscription_id, tratar renovacoes |
| `profiles` (banco) | Migracao | Nova coluna `asaas_subscription_id` |
| `AsaasTransparentCheckout.tsx` | Modificar | Salvar subscriptionId na resposta |
| `BuyCreditsModal.tsx` | Sem mudanca | -- |
