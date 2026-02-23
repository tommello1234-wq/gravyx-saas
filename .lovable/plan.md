

## Checkout Transparente Asaas - PIX e Cartao de Credito

### Resumo
Substituir completamente o Stripe e o iframe do Asaas por um checkout transparente 100% customizado usando a API do Asaas. O formulario fica dentro do modal, com a identidade visual Blue Orbital do projeto. Suporta PIX (a vista) e cartao de credito (parcelado em ate 12x), para todos os planos (mensal e anual).

### Fluxo do usuario

1. Seleciona o plano (Starter, Premium ou Enterprise) e o ciclo (mensal/anual)
2. Clica em "Assinar"
3. Aparece o formulario de checkout com duas abas: **PIX** e **Cartao de Credito**
4. **PIX**: mostra QR Code + codigo copia-e-cola, valor a vista. Apos pagamento confirmado, plano ativa automaticamente via webhook
5. **Cartao**: formulario com dados do cartao, CPF, CEP, telefone, seletor de parcelas. Pagamento processado na hora

### Mudancas

#### 1. Nova Edge Function: `process-asaas-payment`
Substitui `create-asaas-checkout`. Recebe o metodo de pagamento e processa:

**Fluxo interno:**

```text
Frontend                     Edge Function                      Asaas API
   |                              |                                 |
   |-- POST (tier, cycle,         |                                 |
   |   paymentMethod, cardData?)  |                                 |
   |                              |-- POST /v3/customers ---------->|
   |                              |<-- customer_id -----------------|
   |                              |                                 |
   |  [Se CREDIT_CARD]            |                                 |
   |                              |-- POST /v3/payments ----------->|
   |                              |   (billingType: CREDIT_CARD,    |
   |                              |    creditCard, creditCardHolder) |
   |                              |<-- payment result --------------|
   |                              |                                 |
   |  [Se PIX]                    |                                 |
   |                              |-- POST /v3/payments ----------->|
   |                              |   (billingType: PIX)            |
   |                              |<-- payment_id ------------------|
   |                              |-- GET /v3/payments/{id}/pixQrCode ->|
   |                              |<-- QR code + payload ------------|
   |                              |                                 |
   |<-- result (success/pixData) -|                                 |
```

**Payload recebido do frontend:**

```text
{
  tier: "starter" | "premium" | "enterprise"
  cycle: "monthly" | "annual"
  paymentMethod: "PIX" | "CREDIT_CARD"
  installmentCount?: number (2-12, apenas cartao parcelado)
  creditCard?: { holderName, number, expiryMonth, expiryYear, ccv }
  creditCardHolderInfo?: { name, email, cpfCnpj, postalCode, addressNumber, phone }
  remoteIp?: string
}
```

**Valores processados (configurados na Edge Function):**

| Plano | Mensal | Anual |
|-------|--------|-------|
| Starter | R$ 79 | R$ 420 |
| Premium | R$ 167 | R$ 1.097 |
| Enterprise | R$ 347 | R$ 2.597 |

- Para cartao: suporta parcelamento de 2x a 12x (calculo automatico do valor por parcela)
- Para PIX: sempre a vista (valor cheio)

**Ativacao do plano:**
- Cartao de credito: o Asaas confirma na hora, a Edge Function ja atualiza o perfil do usuario (credits, tier, billing_cycle, subscription_status) diretamente, sem depender do webhook
- PIX: ativacao acontece via webhook `PAYMENT_CONFIRMED` (ja implementado no `asaas-webhook`)

**externalReference format:** `gravyx_{cycle}_{tier}_{userId}` (expandido para suportar mensal tambem)

#### 2. Novo componente: `AsaasTransparentCheckout.tsx`
Formulario de checkout bonito seguindo a identidade Blue Orbital:

- **Abas PIX / Cartao** com animacao suave
- **Aba PIX**: 
  - Mostra valor total a vista
  - QR Code renderizado como imagem (base64 retornado pela API)
  - Campo de texto com payload copia-e-cola + botao copiar
  - Timer de expiracao (15 minutos)
  - Polling a cada 5s para verificar se pagamento foi confirmado
- **Aba Cartao**:
  - Nome no cartao
  - Numero do cartao (mascara 0000 0000 0000 0000)
  - Validade (MM/AA) e CVV lado a lado
  - Nome completo do titular
  - CPF/CNPJ (mascara automatica)
  - CEP (mascara 00000-000) e Numero do endereco lado a lado
  - Telefone (mascara)
  - Seletor de parcelas (1x a 12x com valor calculado)
  - Botao "Pagar R$ XX,XX"
- **Visual**: glassmorphism, bordas primary/20, inputs com bg-muted/30, botao gradiente azul, icones Lucide
- **Validacao**: zod no frontend
- **Feedback**: estados de loading, sucesso (confetti/checkmark), e erro

#### 3. Atualizar `BuyCreditsModal.tsx`
- Remover imports do `StripeEmbeddedCheckout` e `AsaasEmbeddedCheckout`
- Remover estado `asaasCheckoutUrl` e `checkoutPlan`
- Novo estado: `selectedPlan: { tier, cycle } | null`
- Corrigir bug: mudar `loadingAsaas` (boolean) para `loadingTier: string | null` (rastreia qual botao esta carregando)
- Quando usuario clica em "Assinar", seta `selectedPlan` e mostra o `AsaasTransparentCheckout`
- Passar `tier`, `cycle`, preco e creditos para o componente de checkout

#### 4. Atualizar `asaas-webhook` Edge Function
- Expandir `parseTierFromReference` para suportar novo formato `gravyx_monthly_{tier}_{userId}` alem do `gravyx_annual_{tier}_{userId}`
- Adicionar config de creditos mensais no `TIER_FROM_REF`
- PIX mensal: ativacao via webhook com creditos mensais
- PIX anual: ativacao via webhook com creditos anuais (ja funciona)

#### 5. Remover componentes/funcoes obsoletos
- `src/components/AsaasEmbeddedCheckout.tsx` - deletar
- `src/components/StripeEmbeddedCheckout.tsx` - deletar
- `supabase/functions/create-asaas-checkout/index.ts` - substituido por `process-asaas-payment`
- `supabase/functions/create-checkout/index.ts` (Stripe) - manter para legado mas nao sera mais chamado pelo modal

#### 6. Adicionar config no `supabase/config.toml`
```text
[functions.process-asaas-payment]
verify_jwt = false
```

### Seguranca
- Dados do cartao transitam via HTTPS do frontend para a Edge Function, e da Edge Function para a API do Asaas - nunca sao armazenados
- `remoteIp` capturado no frontend (requisito do Asaas para checkout transparente com cartao)
- Validacao com zod no frontend e sanitizacao no backend
- Webhook continua protegido por token (`ASAAS_WEBHOOK_TOKEN`)
- Protecao contra duplicatas via `credit_purchases.transaction_id`

### Notas importantes
- A API do Asaas nao permite criar uma cobranca com dois billingTypes diferentes. Por isso, o frontend envia o metodo escolhido e a Edge Function cria a cobranca com o tipo correto
- Para parcelamento com cartao: usa-se `installmentCount` e `totalValue` no payload do Asaas (o calculo por parcela e automatico)
- Para PIX: o QR Code e obtido via endpoint separado `GET /v3/payments/{id}/pixQrCode` apos criar a cobranca

