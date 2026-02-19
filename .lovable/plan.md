## Migração Ticto para Stripe - Implementação Completa

### Passo 1: Criar Produtos e Preços no Stripe

Usando as ferramentas nativas, vou criar 3 produtos com 6 preços:


| Produto    | Mensal                            | Anual                               |
| ---------- | --------------------------------- | ----------------------------------- |
| Starter    | R$ 79/mês (recorrente, trial 7d)  | R$ 420/ano (recorrente, trial 7d)   |
| Premium    | R$ 167/mês (recorrente, trial 7d) | R$ 1.097/ano (recorrente, trial 7d) |
| Enterprise | R$ 347/mês (recorrente, trial 7d) | R$ 2.597/ano (recorrente, trial 7d) |


Os IDs gerados pelo Stripe (price_xxx, prod_xxx) serão usados diretamente no código.

### Passo 2: Criar Edge Function `create-checkout-session`

**Arquivo:** `supabase/functions/create-checkout-session/index.ts`

- Recebe `price_id` do frontend
- Autentica o usuário via token JWT
- Busca/cria customer no Stripe pelo email
- Cria Checkout Session com `mode: "subscription"`
- Aplica trial de 7 dias para planos mensais
- Retorna URL de checkout para redirecionamento

### Passo 3: Criar Edge Function `stripe-webhook`

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

Replica toda a lógica do ticto-webhook atual, adaptada para eventos Stripe:

- `checkout.session.completed` (com trial) -> ativar trial com 5 créditos
- `invoice.paid` -> ativar plano + adicionar créditos do ciclo
- `customer.subscription.updated` (cancel_at_period_end) -> logar cancelamento
- `customer.subscription.deleted` -> downgrade para Free
- `charge.refunded` -> reverter créditos + downgrade
- `invoice.payment_failed` -> logar como alerta
- Auto-criação de conta (mesma lógica do ticto-webhook)
- Validação de assinatura via Stripe webhook signing secret
- Proteção contra duplicatas via transaction_id

Precisa do secret `STRIPE_WEBHOOK_SECRET` (vou solicitar na implementação).

### Passo 4: Atualizar `BuyCreditsModal.tsx`

- Remover URLs de checkout da Ticto
- Adicionar mapeamento de `price_id` do Stripe para cada plano/ciclo
- Ao clicar "Assinar", chamar `supabase.functions.invoke('create-checkout-session')` com o `price_id`
- Redirecionar para URL de checkout retornada
- Estado de loading no botão durante a requisição

### Passo 5: Atualizar `supabase/config.toml`

Registrar as duas novas edge functions com `verify_jwt = false`.

### O que NÃO muda

- `ticto-webhook` continua funcionando para assinantes legados
- Nenhuma alteração no banco de dados (tabelas existentes são reutilizadas)
- Lógica de trial diário (cron job) permanece igual
- Sistema de auto-criação de conta mantido

### Detalhes Técnicos

- Stripe SDK: `https://esm.sh/stripe@18.5.0` (versão estável para Deno)
- API version: `2025-08-27.basil`
- Webhook signature validation via `stripe.webhooks.constructEventAsync`
- Mapeamento price_id -> config do plano (credits, tier, billing_cycle, max_projects) hardcoded na edge function
- Trial de 7 dias configurado via `subscription_data.trial_period_days` no Checkout Session