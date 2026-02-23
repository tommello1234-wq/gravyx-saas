

## Checkout Standalone - Implementacao

### 1. Criar `src/pages/Checkout.tsx`

Nova pagina que le `plan` e `cycle` da URL e renderiza o checkout do Asaas diretamente.

- Le parametros via `useSearchParams()`
- Valida se `plan` e `cycle` sao validos (senao mostra mensagem de erro com link para `/projects`)
- Usa os mesmos precos/creditos do `BuyCreditsModal` (hardcoded no componente)
- Renderiza `AsaasTransparentCheckout` com os dados do plano
- Apos sucesso, redireciona para `/projects`
- Visual limpo: fundo escuro, logo GravyX centralizada, card com o checkout

### 2. Modificar `src/App.tsx`

- Importar `Checkout` de `./pages/Checkout`
- Adicionar rota `/checkout` envolvida em `ProtectedRoute` (usuario precisa estar logado)

### 3. Corrigir `src/pages/Auth.tsx` (linha 25)

Atualmente o redirect apos login so preserva o `pathname`, perdendo os query params (`?plan=starter&cycle=monthly`). A correcao vai preservar tambem o `search` da location, garantindo que o usuario volte ao checkout com os parametros corretos.

**De:**
```
const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/home';
```

**Para:**
```
const fromLocation = (location.state as { from?: { pathname: string; search?: string } })?.from;
const from = fromLocation ? (fromLocation.pathname + (fromLocation.search || '')) : '/home';
```

### Links finais

| Plano | Ciclo | URL |
|-------|-------|-----|
| Starter Mensal | `app.gravyx.com.br/checkout?plan=starter&cycle=monthly` |
| Starter Anual | `app.gravyx.com.br/checkout?plan=starter&cycle=annual` |
| Premium Mensal | `app.gravyx.com.br/checkout?plan=premium&cycle=monthly` |
| Premium Anual | `app.gravyx.com.br/checkout?plan=premium&cycle=annual` |
| Enterprise Mensal | `app.gravyx.com.br/checkout?plan=enterprise&cycle=monthly` |
| Enterprise Anual | `app.gravyx.com.br/checkout?plan=enterprise&cycle=annual` |

