

## Implementacao do Checkout Transparente Asaas

Plano ja revisado e aprovado anteriormente. Pronto para implementar os seguintes arquivos:

### 1. Criar `supabase/functions/process-asaas-payment/index.ts`
Nova Edge Function que:
- Autentica usuario via JWT (getClaims)
- Cria/busca customer no Asaas (`/v3/customers`)
- Para PIX: cria cobranca + busca QR Code via `/v3/payments/{id}/pixQrCode`
- Para cartao: processa pagamento com suporte a parcelamento 1x-12x
- Se cartao aprovado na hora, ativa plano direto no banco (profiles + credit_purchases)
- Valores: Starter R$79/R$420, Premium R$167/R$1.097, Enterprise R$347/R$2.597

### 2. Criar `src/components/AsaasTransparentCheckout.tsx`
Componente de checkout com visual Blue Orbital:
- Abas PIX/Cartao com framer-motion
- PIX: QR Code base64, copia-e-cola, timer 15min, polling 5s
- Cartao: campos com mascaras (cartao, CPF, CEP, telefone), seletor de parcelas
- Estados: form, processing, pix-waiting, success, error
- Captura remoteIp via ipify

### 3. Reescrever `src/components/BuyCreditsModal.tsx`
- Remover Stripe e Asaas iframe
- Novo estado `selectedPlan: { tier, cycle } | null`
- Ao clicar "Assinar", mostra AsaasTransparentCheckout
- Corrigido bug do loading em todos os botoes

### 4. Atualizar `supabase/functions/asaas-webhook/index.ts`
- Novo formato externalReference: `gravyx_(monthly|annual)_{tier}_{userId}`
- Creditos mensais: starter:80, premium:250, enterprise:600
- billing_cycle dinamico baseado no ciclo

### 5. Atualizar `supabase/config.toml`
- Adicionar `[functions.process-asaas-payment]` com `verify_jwt = false`

### 6. Esvaziar componentes obsoletos
- `AsaasEmbeddedCheckout.tsx` e `StripeEmbeddedCheckout.tsx` viram exports vazios

