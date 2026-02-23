

## Checkout Transparente Asaas - PIX e Cartao de Credito

### Resumo
Substituir completamente o Stripe e o iframe do Asaas por um checkout transparente 100% customizado usando a API do Asaas. O formulario fica dentro do modal, com a identidade visual Blue Orbital do projeto. Suporta PIX (a vista) e cartao de credito (parcelado em ate 12x), para todos os planos (mensal e anual).

### Fluxo do usuario

1. Seleciona o plano (Starter, Premium ou Enterprise) e o ciclo (mensal/anual)
2. Clica em "Assinar"
3. Aparece o formulario de checkout com duas abas: PIX e Cartao de Credito
4. PIX: mostra QR Code + codigo copia-e-cola, valor a vista. Apos pagamento confirmado, plano ativa automaticamente via webhook
5. Cartao: formulario com dados do cartao, CPF, CEP, telefone, seletor de parcelas. Pagamento processado na hora

### Arquivos a criar

**1. `supabase/functions/process-asaas-payment/index.ts`** - Nova Edge Function
- Autentica usuario via JWT
- Cria/busca customer no Asaas via `/v3/customers`
- Cria cobranca via `/v3/payments` com billingType PIX ou CREDIT_CARD
- Para PIX: busca QR Code via `/v3/payments/{id}/pixQrCode` e retorna base64 + payload
- Para cartao: processa na hora, se confirmado ativa plano diretamente no banco
- Suporta parcelamento 2x-12x para cartao
- Valores hardcoded: Starter R$79/R$420, Premium R$167/R$1.097, Enterprise R$347/R$2.597
- externalReference: `gravyx_{cycle}_{tier}_{userId}`

**2. `src/components/AsaasTransparentCheckout.tsx`** - Novo componente de checkout
- Duas abas: PIX e Cartao de Credito com animacao framer-motion
- Aba PIX: valor a vista, QR Code (imagem base64), payload copia-e-cola, timer 15min, polling 5s para confirmar pagamento
- Aba Cartao: formulario completo (nome, numero, validade, CVV, CPF/CNPJ, CEP, numero endereco, telefone, seletor parcelas)
- Visual Blue Orbital: glassmorphism, bg-muted/30 nos inputs, bordas primary/20, botao gradiente azul
- Validacao com mascaras (cartao, CPF, CEP, telefone)
- Estados: loading, sucesso (checkmark animado), erro
- Captura remoteIp via API externa para requisito do Asaas

### Arquivos a modificar

**3. `src/components/BuyCreditsModal.tsx`**
- Remover imports de StripeEmbeddedCheckout e AsaasEmbeddedCheckout
- Remover estados checkoutPlan e asaasCheckoutUrl
- Novo estado: `selectedPlan: { tier: TierKey, cycle: BillingCycle } | null`
- Corrigir bug: loadingAsaas boolean vira loadingTier string|null
- Ao clicar "Assinar": seta selectedPlan e mostra AsaasTransparentCheckout
- Passa tier, cycle, preco e creditos para o componente

**4. `supabase/functions/asaas-webhook/index.ts`**
- Expandir parseTierFromReference para novo formato: `gravyx_(monthly|annual)_{tier}_{userId}`
- Adicionar creditos mensais ao TIER_FROM_REF (starter:80, premium:250, enterprise:600)
- Suportar billing_cycle dinamico baseado no ciclo do externalReference

**5. `supabase/config.toml`**
- Adicionar secao `[functions.process-asaas-payment]` com verify_jwt = false

### Arquivos a remover

**6. `src/components/AsaasEmbeddedCheckout.tsx`** - Substituido pelo checkout transparente
**7. `src/components/StripeEmbeddedCheckout.tsx`** - Nao sera mais usado

### Detalhes tecnicos

Payload da Edge Function (frontend envia):
```text
{
  tier: "starter" | "premium" | "enterprise"
  cycle: "monthly" | "annual"
  paymentMethod: "PIX" | "CREDIT_CARD"
  installmentCount?: 2-12
  creditCard?: { holderName, number, expiryMonth, expiryYear, ccv }
  creditCardHolderInfo?: { name, cpfCnpj, postalCode, addressNumber, phone }
  remoteIp?: string
}
```

Seguranca:
- Dados do cartao via HTTPS, nunca armazenados
- remoteIp capturado no frontend (requisito Asaas)
- Validacao zod no frontend, sanitizacao no backend
- Webhook protegido por ASAAS_WEBHOOK_TOKEN
- Duplicatas prevenidas via credit_purchases.transaction_id

