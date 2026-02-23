

## Implementacao do Checkout Transparente Asaas

Todos os arquivos estao prontos para implementacao. Aqui esta o resumo final:

### Arquivos a criar

1. **`supabase/functions/process-asaas-payment/index.ts`** - Edge Function que autentica via JWT, cria customer no Asaas, processa PIX (QR Code) ou cartao de credito (1x-12x), e ativa plano imediatamente para cartao confirmado.

2. **`src/components/AsaasTransparentCheckout.tsx`** - Componente de checkout com abas PIX/Cartao, mascaras de input, polling PIX, timer de expiracao, estados animados (form/processing/pix-waiting/success/error).

### Arquivos a modificar

3. **`src/components/BuyCreditsModal.tsx`** - Remover Stripe/Asaas iframe, novo estado `selectedPlan`, ao clicar "Assinar" mostra o AsaasTransparentCheckout.

4. **`supabase/functions/asaas-webhook/index.ts`** - Novo formato `gravyx_{cycle}_{tier}_{userId}`, creditos mensais (80/250/600) e anuais (1000/3000/7200), billing_cycle dinamico.

5. **`supabase/config.toml`** - Adicionar `[functions.process-asaas-payment]` com `verify_jwt = false`.

### Arquivos a esvaziar

6. **`src/components/StripeEmbeddedCheckout.tsx`** - Export vazio
7. **`src/components/AsaasEmbeddedCheckout.tsx`** - Export vazio

