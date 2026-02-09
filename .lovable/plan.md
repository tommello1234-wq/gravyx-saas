

# Atualizar Domínio para app.gravyx.com.br

## 1. Supabase Dashboard (manual)

Na tela de Authentication > URL Configuration:

- **Site URL**: Alterar para `https://app.gravyx.com.br`
- **Redirect URLs**: Adicionar `https://app.gravyx.com.br/**`

## 2. Alterações no código ✅

- `send-auth-email/index.ts`: DEFAULT_SITE_URL → `https://app.gravyx.com.br`, remetente → `Gravyx`
- `base-layout.tsx`: Links e textos atualizados para Gravyx
- `admin-users/index.ts`: Remetente → `Gravyx`

## Nota

O domínio de envio (`noreply@upwardacademy.com.br`) foi mantido pois é o verificado no Resend.
