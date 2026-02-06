

## Correção do Parsing do Secret do Webhook

### Problema
O Supabase sempre gera o secret no formato `v1,whsec_...`, mas a biblioteca `standardwebhooks` espera apenas a parte `whsec_...` (base64 puro).

### Solução
Modificar a Edge Function `send-auth-email` para automaticamente extrair a parte correta do secret, suportando ambos os formatos:
- `v1,whsec_XXXXX` (formato do Supabase)
- `whsec_XXXXX` (formato esperado pela biblioteca)

### Alteração no Código

**Arquivo:** `supabase/functions/send-auth-email/index.ts`

Adicionar uma função helper que processa o secret:

```typescript
// Helper para extrair o secret no formato correto
function getWebhookSecret(secret: string): string {
  // Se começa com "v1,", remover o prefixo
  if (secret.startsWith('v1,')) {
    return secret.substring(3)
  }
  return secret
}
```

E usar essa função ao criar o Webhook:

```typescript
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string
// ...
const wh = new Webhook(getWebhookSecret(hookSecret))
```

### Próximos Passos
1. Atualizar o `SEND_EMAIL_HOOK_SECRET` com o secret completo do Supabase (incluindo `v1,`)
2. Fazer deploy da Edge Function atualizada
3. Testar o envio de email

### Resultado
Isso permitirá usar o secret exatamente como o Supabase gera, sem precisar remover manualmente o prefixo `v1,`.

