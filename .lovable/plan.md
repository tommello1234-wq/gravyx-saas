

## Migracao de Ticto para Stripe

### Resumo

Substituir a Ticto pela Stripe como gateway de pagamento, aproveitando a integracao nativa da Lovable. A Stripe cobra ~3.99% + R$0.39 por transacao (vs ~7-10% da Ticto), gerando economia significativa.

### Etapas

#### 1. Habilitar Stripe na Lovable
- Usar a ferramenta nativa para conectar a conta Stripe ao projeto
- Isso vai fornecer as ferramentas necessarias para criar produtos e precos automaticamente

#### 2. Criar Produtos e Precos no Stripe
- 3 produtos: Starter, Premium, Enterprise
- 6 precos (mensal + anual para cada):
  - Starter Mensal: R$ 79/mes (trial 7 dias)
  - Starter Anual: R$ 420/ano
  - Premium Mensal: R$ 167/mes (trial 7 dias)
  - Premium Anual: R$ 1.097/ano
  - Enterprise Mensal: R$ 347/mes (trial 7 dias)
  - Enterprise Anual: R$ 2.597/ano

#### 3. Criar Edge Function `stripe-webhook`
- Receber eventos do Stripe (checkout.session.completed, invoice.paid, customer.subscription.deleted, etc.)
- Validar assinatura do webhook usando o Stripe webhook secret
- Logica equivalente ao ticto-webhook atual:
  - Pagamento aprovado -> ativar plano + adicionar creditos
  - Trial iniciado -> ativar trial com 5 creditos
  - Cancelamento -> manter beneficios ate fim do ciclo
  - Assinatura encerrada -> downgrade para Free
  - Reembolso -> reverter creditos
- Auto-criar conta se usuario nao existir (manter logica atual)

#### 4. Atualizar `BuyCreditsModal.tsx`
- Remover links da Ticto
- Usar Stripe Checkout Sessions (via edge function) para redirecionar ao pagamento
- Criar edge function `create-checkout-session` que:
  - Recebe o price_id e user_id
  - Cria sessao de checkout no Stripe
  - Retorna URL de checkout

#### 5. Mapeamento de Eventos Stripe vs Ticto

```text
Ticto                    Stripe
-----                    ------
"periodo de testes"  ->  checkout.session.completed (mode=subscription, trial)
"venda realizada"    ->  invoice.paid
"cancelada"          ->  customer.subscription.updated (cancel_at_period_end=true)
"encerrada"          ->  customer.subscription.deleted
"reembolso"          ->  charge.refunded
"atrasada"           ->  invoice.payment_failed
```

#### 6. O que acontece com assinantes atuais da Ticto
- Manter o `ticto-webhook` funcionando para assinantes existentes
- Novos assinantes vao pela Stripe
- Conforme assinantes da Ticto cancelam naturalmente, a migração se completa

### Arquivos Criados
1. `supabase/functions/create-checkout-session/index.ts` - Cria sessao de checkout
2. `supabase/functions/stripe-webhook/index.ts` - Processa eventos do Stripe

### Arquivos Modificados
1. `src/components/BuyCreditsModal.tsx` - Trocar links Ticto por Stripe Checkout
2. `supabase/config.toml` - Registrar novas edge functions

### Sem Mudancas no Banco de Dados
Todas as tabelas necessarias ja existem (profiles, credit_purchases, webhook_logs).

### Primeira Acao
Habilitar a integracao Stripe na Lovable para obter as ferramentas de criacao de produtos e configuracao de webhooks.

