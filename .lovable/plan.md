

## Correção do Formato do Secret do Webhook

### Problema Identificado
Os logs mostram o erro:
```
Error: Base64Coder: incorrect characters for decoding
```

Isso acontece porque a biblioteca `standardwebhooks` espera o secret no formato **apenas Base64** (`whsec_...`), mas o valor configurado inclui o prefixo `v1,`.

### Causa
- **Formato do Supabase Dashboard**: `v1,whsec_ooKCR6OaNh5Skv69BlHHhQWkUrznfDv3...`
- **Formato esperado pela biblioteca**: `whsec_ooKCR6OaNh5Skv69BlHHhQWkUrznfDv3...`

### Solução

Atualizar o `SEND_EMAIL_HOOK_SECRET` removendo o prefixo `v1,`:

**Valor correto:**
```
whsec_ooKCR6OaNh5Skv69BlHHhQWkUrznfDv3i9G0haGebOwRre316Usxv2fIg9O3bH2UQOVPhEGTDtFRwiTg
```

### Passos
1. Atualizar o secret `SEND_EMAIL_HOOK_SECRET` com o valor sem o prefixo `v1,`
2. Aguardar o redeploy da Edge Function
3. Testar novamente criando uma conta ou solicitando redefinição de senha

### Resultado Esperado
Após a correção, a Edge Function conseguirá verificar a assinatura do webhook corretamente e os emails serão enviados via Resend com os templates customizados.

