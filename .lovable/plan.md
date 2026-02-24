

## Fluxo: Criar Conta Primeiro, Depois Checkout

### Entendimento
O link externo (ex: landing page) leva o usuario para uma tela de **criar conta** (email, senha, confirmar senha). Apos criar a conta, o usuario e redirecionado automaticamente para o **checkout** do plano correspondente.

```text
[Landing Page] → /signup?plan=starter&cycle=monthly
                        ↓
              [Tela de Criar Conta]
              (email, senha, confirmar senha)
                        ↓ (conta criada)
              /checkout?plan=starter&cycle=monthly
                        ↓ (pagamento)
              [Plano ativado → /projects]
```

### Fluxo atual (o que ja existe)
O `/checkout` ja esta protegido por `ProtectedRoute`, que redireciona para `/auth` preservando a URL de retorno. Porem, a pagina `/auth` mostra login E signup juntos, o que nao e ideal para quem vem de uma landing page.

### Mudancas

**1. Nova pagina `src/pages/Signup.tsx`**
- Pagina publica dedicada apenas a **criar conta**
- Campos: email, senha, confirmar senha (com validacao via zod)
- Recebe `plan` e `cycle` como query params
- Mostra o nome do plano selecionado no topo (ex: "Crie sua conta para assinar o plano Starter")
- Apos signup bem-sucedido: redireciona para `/checkout?plan=xxx&cycle=xxx`
- Link "Ja tem conta? Faça login" que leva para `/auth` preservando os params de retorno
- Visual consistente com a pagina `/auth` existente (glass-card, logo, orbs)

**2. Atualizar `src/App.tsx`**
- Adicionar rota publica `/signup` apontando para a nova pagina
- Manter `/checkout` protegido (o usuario ja estara logado ao chegar la)

**3. Atualizar `src/pages/Auth.tsx`**
- Quando o usuario vem de `/signup` (via state ou query params com plan/cycle), apos login redirecionar para `/checkout?plan=xxx&cycle=xxx`

### O que NAO muda
- `AsaasTransparentCheckout.tsx` — continua igual, so funciona com usuario autenticado
- `Checkout.tsx` — continua protegido, sem alteracoes
- `process-asaas-payment` Edge Function — sem alteracoes
- Banco de dados — nenhuma migracao necessaria

### Resumo dos arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/Signup.tsx` | NOVO — tela de criar conta com redirecionamento |
| `src/App.tsx` | Modificar — adicionar rota `/signup` |
| `src/pages/Auth.tsx` | Pequeno ajuste — suportar redirecionamento com plan/cycle |

