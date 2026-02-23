

## Corrigir campo da URL do Asaas Checkout

### Problema
A API do Asaas retorna o campo `link` (nao `url`) na resposta do checkout. O codigo atual usa `asaasData.url` que retorna `undefined`, causando o erro no iframe.

Evidencia nos logs:
```
"link":"https://www.asaas.com/checkoutSession/show/8a47920b-b2fa-4747-9c6d-0f19e895769a"
```

### Correcao

**Arquivo: `supabase/functions/create-asaas-checkout/index.ts`**
- Linha ~109: mudar `asaasData.url` para `asaasData.link`

```typescript
// Antes (ERRADO)
return new Response(JSON.stringify({ checkout_id: asaasData.id, checkout_url: asaasData.url }), ...);

// Depois (CORRETO)
return new Response(JSON.stringify({ checkout_id: asaasData.id, checkout_url: asaasData.link }), ...);
```

Essa e a unica mudanca necessaria. O frontend ja esta preparado para receber `checkout_url` e usar no iframe.
