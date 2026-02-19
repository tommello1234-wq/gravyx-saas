

## Adicionar STRIPE_WEBHOOK_SECRET

Adicionar o secret do webhook do Stripe ao projeto para que a Edge Function `stripe-webhook` consiga validar as assinaturas dos eventos recebidos.

### O que sera feito

1. Solicitar a adição do secret `STRIPE_WEBHOOK_SECRET` com o valor `whsec_...` que você copiou do painel do Stripe.

### Detalhes tecnicos

- O secret sera armazenado de forma segura no Supabase e ficara disponivel como variavel de ambiente para as Edge Functions.
- A Edge Function `stripe-webhook` ja esta configurada para ler `Deno.env.get('STRIPE_WEBHOOK_SECRET')` e usar esse valor para verificar a assinatura dos eventos recebidos do Stripe.

