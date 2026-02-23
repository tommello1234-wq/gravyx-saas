

## Corrigir iframe do Asaas Checkout

### Problema
O checkout do Asaas esta criando a sessao com sucesso (logs confirmam), porem o iframe mostra uma pagina quebrada porque a URL construida manualmente (`https://www.asaas.com/checkoutSession/show?id=...`) nao e a URL correta para renderizar o checkout. A API do Asaas retorna um campo `url` na resposta que deve ser usado diretamente.

### Solucao

**1. Edge Function `create-asaas-checkout/index.ts`**
- Logar a resposta completa do Asaas para ver todos os campos retornados
- Retornar o campo `url` da resposta do Asaas alem do `id`

**2. Frontend `BuyCreditsModal.tsx`**
- Mudar o estado de `asaasCheckoutId` para armazenar a URL completa retornada pelo Asaas

**3. Frontend `AsaasEmbeddedCheckout.tsx`**
- Receber `checkoutUrl` em vez de `checkoutId`
- Usar a URL diretamente no iframe sem construir manualmente

### Detalhes tecnicos

Edge Function - mudar resposta:
```typescript
// Logar resposta completa para debug
logStep("Asaas checkout created", asaasData);

// Retornar url junto com id
return new Response(JSON.stringify({ 
  checkout_id: asaasData.id,
  checkout_url: asaasData.url 
}), ...);
```

AsaasEmbeddedCheckout - usar URL direta:
```typescript
interface Props {
  checkoutUrl: string;
}

export function AsaasEmbeddedCheckout({ checkoutUrl }: Props) {
  // ...
  <iframe src={checkoutUrl} ... />
}
```

BuyCreditsModal - armazenar URL:
```typescript
// Mudar estado
const [asaasCheckoutUrl, setAsaasCheckoutUrl] = useState<string | null>(null);

// No handleSelectPlan
setAsaasCheckoutUrl(data.checkout_url);

// Passar para componente
<AsaasEmbeddedCheckout checkoutUrl={asaasCheckoutUrl} />
```

Se a API do Asaas nao retornar um campo `url`, os logs completos nos mostrarao exatamente quais campos estao disponiveis para usar a URL correta.
