

# Plano: Correção do Webhook Ticto

## Problema Identificado

Analisando os logs, identifiquei **dois problemas** no webhook atual:

### 1. Status "authorized" não está sendo aceito

O payload da Ticto veio com `status: "authorized"`, que é ignorado pelo nosso código. No fluxo do PIX:
- **authorized** = PIX gerado (QR Code criado)
- **approved/paid** = Pagamento confirmado

Porém, na imagem dos postbacks você mostra que o evento é "Venda Realizada", o que indica que o pagamento foi confirmado. Isso sugere que a Ticto pode usar "authorized" como status final para PIX.

### 2. Caminho errado para o código da oferta

No payload real:
```json
{
  "query_params": {
    "code": "O37CE7121"
  }
}
```

No código atual:
```typescript
const offerCode = body.url_params?.query_params?.code || '';  // ❌ Errado
```

Deveria ser:
```typescript
const offerCode = body.query_params?.code || body.offer?.code || '';  // ✅ Correto
```

---

## Correções Necessárias

### 1. Adicionar "authorized" como status válido

Para PIX, o status "authorized" significa que o pagamento foi processado. Vamos adicioná-lo à lista de status aprovados.

```typescript
const approvalStatuses = ['approved', 'paid', 'confirmed', 'completed', 'authorized'];
```

### 2. Corrigir extração do código da oferta

O código da oferta pode vir em diferentes lugares do payload:

```typescript
const offerCode = 
  body.query_params?.code ||           // Estrutura real observada
  body.offer?.code ||                  // Fallback 1
  body.item?.offer_code ||             // Fallback 2
  body.url_params?.query_params?.code || // Estrutura original
  '';
```

### 3. Atualizar a interface TypeScript

Adicionar o campo `query_params` no nível raiz e `offer.code`:

```typescript
interface TictoPayload {
  status?: string;
  payment_method?: string;
  query_params?: {
    code?: string;
    offer_code?: string;
  };
  offer?: {
    id?: number;
    code?: string;
    name?: string;
  };
  // ... resto da interface
}
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ticto-webhook/index.ts` | Corrigir extração do offerCode e adicionar "authorized" |

---

## Resumo das Mudanças no Código

```typescript
// 1. Adicionar "authorized" aos status válidos
const approvalStatuses = ['approved', 'paid', 'confirmed', 'completed', 'authorized'];

// 2. Corrigir extração do código da oferta (múltiplos fallbacks)
const offerCode = 
  body.query_params?.code || 
  body.offer?.code || 
  body.item?.offer_code ||
  body.url_params?.query_params?.code || 
  '';

// 3. Atualizar interface para incluir query_params e offer
```

---

## Após a Correção

1. O webhook será deployado automaticamente
2. Você pode usar o botão "Reenviar" no painel da Ticto para reprocessar o mesmo evento
3. Os créditos serão adicionados automaticamente

