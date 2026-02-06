

## Atualização do Secret do Webhook de Email

### Objetivo
Atualizar o `SEND_EMAIL_HOOK_SECRET` com o valor correto gerado pelo Supabase para que o Auth Hook funcione corretamente.

### Ação Necessária

**Atualizar o secret** `SEND_EMAIL_HOOK_SECRET` com o valor:
```
v1,whsec_ooKCR6OaNh5Skv69BlHHhQWkUrznfDv3i9G0haGebOwRre316Usxv2fIg9O3bH2UQOVPhEGTDtFRwiTg
```

### Próximos Passos (após aprovação)

1. Atualizar o secret no projeto
2. Aguardar o deploy da edge function
3. Salvar o Auth Hook no Supabase Dashboard com:
   - **Hook type**: HTTPS
   - **URL**: `https://oruslrvpmdhtnrsgoght.supabase.co/functions/v1/send-auth-email`
   - **Signing secret**: O mesmo valor acima

### Resultado Esperado
Os emails de autenticação (confirmação, recuperação de senha, magic link) serão enviados usando os templates customizados via Resend.

