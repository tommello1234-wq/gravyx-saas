

# Integrar Stripe para Planos Mensais (Ticto para Anuais)

## Resumo

Os planos **mensais** passam a usar Stripe Checkout. Os planos **anuais** continuam com os links da Ticto. Serao criadas duas Edge Functions e o modal de compra sera atualizado.

## Produtos Stripe ja criados

| Plano | Product ID | Price ID | Valor |
|---|---|---|---|
| Starter Mensal | prod_U0eazTPI46cBd4 | price_1T2dH9QaS2QCKPVAO3z0v3as | R$ 79/mes |
| Premium Mensal | prod_U0eg3wu7ck4oGW | price_1T2dNOQaS2QCKPVAPcfLgTg6 | R$ 167/mes |
| Enterprise Mensal | prod_U0emfKast87JEJ | price_1T2dSeQaS2QCKPVAboY5jaQF | R$ 347/mes |

## O que sera feito

### 1. Criar arquivo de mapeamento Stripe (`src/lib/stripe-plans.ts`)

Arquivo com os `price_id` e `product_id` de cada tier mensal, para ser usado pelo frontend ao chamar o checkout.

### 2. Criar Edge Function `create-checkout` 

- Autentica o usuario via JWT (getClaims)
- Busca/cria customer no Stripe pelo email
- Cria Checkout Session no modo `subscription` com o `price_id` recebido
- Inclui metadata com o `tier` para o webhook saber qual plano ativar
- Retorna a URL do checkout

### 3. Criar Edge Function `stripe-webhook`

- Valida a assinatura do webhook com `STRIPE_WEBHOOK_SECRET`
- Eventos tratados:
  - `checkout.session.completed` -- ativa assinatura, credita creditos, atualiza tier/billing_cycle/max_projects/subscription_status
  - `invoice.paid` -- renovacao mensal, adiciona creditos do ciclo (com protecao contra duplicata via transaction_id)
  - `customer.subscription.deleted` -- downgrade para Free
  - `invoice.payment_failed` -- loga como alerta
- Mesma logica de auto-criacao de conta do Ticto webhook (reutiliza o padrao de findOrCreateProfile)
- Protecao contra duplicatas via `transaction_id` na tabela `credit_purchases`

### 4. Atualizar `BuyCreditsModal.tsx`

- Para ciclo **mensal**: chamar `supabase.functions.invoke('create-checkout', { body: { price_id, tier } })` e redirecionar para a URL retornada pelo Stripe
- Para ciclo **anual**: manter o `window.open(tictoUrl)` atual (sem mudancas)
- Adicionar estado de loading no botao durante a criacao do checkout

### 5. Registrar novas functions no `supabase/config.toml`

```text
[functions.create-checkout]
verify_jwt = false

[functions.stripe-webhook]
verify_jwt = false
```

## Detalhes Tecnicos

### Mapeamento Stripe

```text
STRIPE_PLANS = {
  starter:    { price_id: 'price_1T2dH9QaS2QCKPVAO3z0v3as', product_id: 'prod_U0eazTPI46cBd4' },
  premium:    { price_id: 'price_1T2dNOQaS2QCKPVAPcfLgTg6', product_id: 'prod_U0eg3wu7ck4oGW' },
  enterprise: { price_id: 'price_1T2dSeQaS2QCKPVAboY5jaQF', product_id: 'prod_U0emfKast87JEJ' },
}
```

### Mapeamento de creditos no webhook Stripe

O webhook usara o mesmo mapeamento de beneficios do Ticto:

| Tier | Creditos/mes | Max Projetos |
|---|---|---|
| starter | 80 | 3 |
| premium | 250 | -1 |
| enterprise | 600 | -1 |

### Fluxo do checkout mensal

```text
1. Usuario clica "Assinar Starter" (mensal)
2. Frontend chama create-checkout com price_id e tier
3. Edge Function cria Stripe Checkout Session
4. Usuario e redirecionado para pagina do Stripe
5. Stripe processa pagamento
6. Webhook stripe-webhook recebe checkout.session.completed
7. Atualiza profiles: tier, credits, subscription_status='active', billing_cycle='monthly', max_projects
8. Registra em credit_purchases para protecao contra duplicata
```

### Arquivos criados/modificados

- **Novo**: `src/lib/stripe-plans.ts`
- **Novo**: `supabase/functions/create-checkout/index.ts`
- **Novo**: `supabase/functions/stripe-webhook/index.ts`
- **Modificado**: `src/components/BuyCreditsModal.tsx`
- **Modificado**: `supabase/config.toml`

### Secrets

Ja configuradas: `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`. Nenhuma nova secret necessaria.

### Pos-deploy

Apos o deploy, sera necessario cadastrar a URL do webhook no painel do Stripe:
`https://oruslrvpmdhtnrsgoght.supabase.co/functions/v1/stripe-webhook`

Eventos para escutar: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `invoice.payment_failed`.

