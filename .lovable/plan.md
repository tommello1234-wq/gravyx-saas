

## Criar Pagina de Checkout Standalone com Links Externos

### Objetivo

Criar uma rota publica `/checkout` que pode ser acessada via link direto (ex: `app.gravyx.com.br/checkout?plan=starter&cycle=monthly`), permitindo usar esses links no Elementor ou qualquer landing page externa -- igual funcionava com os links da Ticto.

### Como vai funcionar

1. O usuario clica no link na pagina do Elementor
2. Abre a pagina de checkout no `app.gravyx.com.br/checkout?plan=starter&cycle=monthly`
3. Se nao estiver logado, redireciona para login e volta ao checkout apos autenticar
4. Exibe o checkout transparente do Asaas (mesmo componente atual) com o plano ja selecionado
5. Apos pagamento, redireciona para `/projects`

### Links que voce tera disponivel

| Plano | Ciclo | URL |
|-------|-------|-----|
| Starter | Mensal | `app.gravyx.com.br/checkout?plan=starter&cycle=monthly` |
| Starter | Anual | `app.gravyx.com.br/checkout?plan=starter&cycle=annual` |
| Premium | Mensal | `app.gravyx.com.br/checkout?plan=premium&cycle=monthly` |
| Premium | Anual | `app.gravyx.com.br/checkout?plan=premium&cycle=annual` |
| Enterprise | Mensal | `app.gravyx.com.br/checkout?plan=enterprise&cycle=monthly` |
| Enterprise | Anual | `app.gravyx.com.br/checkout?plan=enterprise&cycle=annual` |

### Arquivos a criar/modificar

**1. Criar `src/pages/Checkout.tsx` (novo)**
- Pagina publica que le `plan` e `cycle` da query string
- Valida os parametros (redireciona para `/projects` se invalidos)
- Exibe header minimo com logo do GravyX
- Renderiza o `AsaasTransparentCheckout` com os dados do plano
- Apos sucesso, redireciona para `/projects`

**2. Modificar `src/App.tsx`**
- Adicionar rota `/checkout` envolvida em `ProtectedRoute` (exige login)
- Se o usuario nao estiver logado, o `ProtectedRoute` ja redireciona para `/auth`, e apos login ele volta ao checkout

**3. Modificar `src/components/layout/ProtectedRoute.tsx`**
- Garantir que apos login, o usuario retorne a URL original (incluindo query params do checkout)
- Se ja tiver esse comportamento, nenhuma mudanca necessaria

### Detalhes tecnicos

A pagina `Checkout.tsx` vai:
- Usar `useSearchParams()` para ler `plan` e `cycle`
- Buscar preco/creditos do mesmo array de planos usado no `BuyCreditsModal`
- Reutilizar o componente `AsaasTransparentCheckout` sem nenhuma modificacao
- Ter visual limpo: fundo escuro, logo centralizada, card de checkout no centro
- Ser responsiva (funcionar bem em mobile, ja que vem de landing page)

Nenhuma mudanca em Edge Functions ou banco de dados -- apenas frontend.
