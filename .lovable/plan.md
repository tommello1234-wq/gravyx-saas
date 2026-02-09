

# Atualizar Domínio para app.gravity.com.br

## 1. Supabase Dashboard (manual)

Na tela de Authentication > URL Configuration:

- **Site URL**: Alterar de `https://ai.upwardacademy.com.br` para `https://app.gravity.com.br`
- **Redirect URLs**: Adicionar `https://app.gravity.com.br/**` e remover `https://ai.upwardacademy.com.br` e `https://node-artistry-12.lovable.app/` (duplicado)

## 2. Alteracoes no codigo

### Arquivo: `supabase/functions/send-auth-email/index.ts`

- Linha 20: Alterar `DEFAULT_SITE_URL` de `'https://node-artistry-12.lovable.app'` para `'https://app.gravity.com.br'`
- Linha 179: Alterar remetente de `'Avion <noreply@upwardacademy.com.br>'` para `'Gravyx <noreply@upwardacademy.com.br>'` (manter dominio de email pois e o dominio verificado no Resend)

### Arquivo: `supabase/functions/send-auth-email/_templates/base-layout.tsx`

- Linhas 162 e 166: Alterar links de `https://node-artistry-12.lovable.app` para `https://app.gravity.com.br`
- Alterar texto "Acessar Avion" para "Acessar Gravyx"

### Arquivo: `supabase/functions/admin-users/index.ts`

- Linha 80: Alterar remetente de `"Node Artistry <noreply@upwardacademy.com.br>"` para `"Gravyx <noreply@upwardacademy.com.br>"`

---

## Nota importante

O dominio de envio de email (`noreply@upwardacademy.com.br`) deve ser mantido, pois e o dominio verificado no Resend. Se quiser usar `noreply@gravity.com.br`, precisara verificar o dominio `gravity.com.br` no painel do Resend primeiro.

