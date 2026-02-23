

## Migrar para Assinaturas Recorrentes no Asaas

### Status: ✅ Implementado

### O que foi feito

1. **Migração de banco**: Coluna `asaas_subscription_id` adicionada à tabela `profiles`
2. **`process-asaas-payment/index.ts`**: Migrado de `/v3/payments` para `POST /v3/subscriptions`
   - Cycle MONTHLY ou YEARLY
   - PIX: cria subscription com billingType UNDEFINED, busca primeiro pagamento, gera QR Code
   - Cartão: processa com dados de cartão, verifica primeira cobrança
   - Parcelamento apenas para planos anuais (até 12x)
   - Salva subscriptionId no perfil
3. **`asaas-webhook/index.ts`**: Atualizado para:
   - Salvar `asaas_subscription_id` quando presente no payload de pagamento
   - Tratar `PAYMENT_OVERDUE` marcando `subscription_status` como `past_due`
   - Limpar `asaas_subscription_id` em refund/chargeback
4. **`AsaasTransparentCheckout.tsx`**: Parcelas só aparecem para plano anual

### Regras de negócio
- **Mensal**: assinatura recorrente, cartão ou PIX, sem parcelamento
- **Anual**: assinatura recorrente, PIX à vista ou cartão em até 12x
