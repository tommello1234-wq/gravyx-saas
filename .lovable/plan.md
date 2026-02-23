

# Integrar Asaas Checkout para Planos Anuais (12x no cartao)

## Resumo

Os planos **anuais** passarao a usar o **Asaas Checkout** embutido em iframe dentro do modal, substituindo os links da Ticto. Os planos **mensais** continuam com Stripe. O Asaas Checkout API cria uma sessao de checkout que retorna um ID, e a pagina de pagamento e exibida via `https://asaas.com/checkoutSession/show?id={ID}` em um iframe.

## O que sera feito

### 1. Adicionar secret `ASAAS_API_KEY` no Supabase

A API Key do Asaas sera armazenada como secret no Supabase para uso exclusivo nas Edge Functions.

### 2. Criar Edge Function `create-asaas-checkout`

- Autentica o usuario via JWT
- Chama `POST https://api.asaas.com/v3/checkouts` com:
  - `billingTypes: ["CREDIT_CARD"]`
  - `chargeTypes: ["INSTALLMENT"]`
  - `installment: { maxInstallmentCount: 12 }`
  - `items` com nome do plano e valor total anual
  - `callback` com URLs de sucesso/cancelamento
  - `externalReference` com `user_id` e `tier` para o webhook identificar
  - `customerData` com email do usuario
- Retorna o `checkout_id` para o frontend montar a URL do iframe

### 3. Criar Edge Function `asaas-webhook`

- Valida o token de autenticacao do webhook (header `asaas-access-token`)
- Eventos tratados:
  - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` -- primeira parcela paga, ativa o plano anual (creditos totais do ano, tier, billing_cycle='annual', subscription_status='active')
  - `PAYMENT_REFUNDED` / `PAYMENT_CHARGEBACK_REQUESTED` -- downgrade para Free
  - `PAYMENT_OVERDUE` -- loga como alerta
- Reutiliza o padrao de `findOrCreateProfile` e `credit_purchases` para protecao contra duplicatas
- Creditos anuais aplicados de uma vez (mesmo padrao da Ticto): Starter 1000, Premium 3000, Enterprise 7200

### 4. Criar componente `AsaasEmbeddedCheckout.tsx`

- Recebe `checkoutId` como prop
- Renderiza um iframe apontando para `https://www.asaas.com/checkoutSession/show?id={checkoutId}`
- Exibe loading enquanto o iframe carrega

### 5. Atualizar `BuyCreditsModal.tsx`

- Para ciclo **anual**: chamar `supabase.functions.invoke('create-asaas-checkout')` com tier e email, receber o `checkout_id`, e exibir o `AsaasEmbeddedCheckout` dentro do modal (mesmo padrao visual do Stripe mensal)
- Para ciclo **mensal**: manter Stripe (sem mudancas)
- Remover os links da Ticto dos planos anuais

### 6. Registrar webhook no painel do Asaas

Apos o deploy, configurar a URL do webhook no painel do Asaas:
`https://oruslrvpmdhtnrsgoght.supabase.co/functions/v1/asaas-webhook`

Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_OVERDUE`

## Detalhes Tecnicos

### Mapeamento de planos anuais no Asaas

| Plano | Valor Total | 12x de | Creditos |
|---|---|---|---|
| Starter | R$ 420 | R$ 35 | 1.000 |
| Premium | R$ 1.097 | R$ 91,42 | 3.000 |
| Enterprise | R$ 2.597 | R$ 216,42 | 7.200 |

### Payload do checkout (exemplo Starter)

```text
POST https://api.asaas.com/v3/checkouts
{
  "billingTypes": ["CREDIT_CARD"],
  "chargeTypes": ["INSTALLMENT"],
  "minutesToExpire": 60,
  "externalReference": "gravyx_annual_starter_{user_id}",
  "callback": {
    "successUrl": "https://app.gravyx.com.br/projects?checkout=success",
    "cancelUrl": "https://app.gravyx.com.br/projects",
    "expiredUrl": "https://app.gravyx.com.br/projects"
  },
  "items": [{ "name": "Gravyx Starter Anual", "quantity": 1, "value": 420.00 }],
  "installment": { "maxInstallmentCount": 12 },
  "customerData": { "email": "user@email.com" }
}
```

### Fluxo do checkout anual

```text
1. Usuario clica "Assinar Starter" (anual)
2. Frontend chama create-asaas-checkout com tier
3. Edge Function cria Checkout no Asaas
4. Frontend exibe iframe com a pagina de checkout do Asaas
5. Usuario preenche dados do cartao e confirma 12x
6. Asaas processa primeira parcela
7. Webhook asaas-webhook recebe PAYMENT_CONFIRMED
8. Atualiza profiles: tier, credits (total anual), billing_cycle='annual', subscription_status='active'
9. Registra em credit_purchases com transaction_id para evitar duplicata
```

### Arquivos criados/modificados

- **Novo**: `supabase/functions/create-asaas-checkout/index.ts`
- **Novo**: `supabase/functions/asaas-webhook/index.ts`
- **Novo**: `src/components/AsaasEmbeddedCheckout.tsx`
- **Modificado**: `src/components/BuyCreditsModal.tsx` (anual usa Asaas em vez de Ticto)
- **Modificado**: `supabase/config.toml` (registrar novas functions)

### Secrets necessarias

- `ASAAS_API_KEY` -- a chave que voce acabou de enviar (sera adicionada via ferramenta de secrets)

### Pos-deploy

1. Cadastrar URL do webhook no painel do Asaas (Configuracoes > Integracoes > Webhooks)
2. Configurar o token de autenticacao do webhook no Asaas e salvar como `ASAAS_WEBHOOK_TOKEN` no Supabase

