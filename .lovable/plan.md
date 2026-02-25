

## Gerenciamento de Preços e Cupons no Admin

### Problema atual

Os preços dos planos estão hardcoded em 4 lugares diferentes: `BuyCreditsModal.tsx`, `Checkout.tsx`, `process-asaas-payment/index.ts` e `plan-limits.ts`. Alterar preços exige editar código. Cupons de desconto não existem.

### Arquitetura proposta

```text
[Admin: aba "Preços & Cupons"]
    ├── Tabela editável de preços por tier/cycle
    └── CRUD de cupons de desconto
         │
         ▼
[Tabelas Supabase: plan_pricing + coupons + coupon_usages]
         │
         ▼
[Frontend: BuyCreditsModal + Checkout] ← busca preços via query
[Edge Function: process-asaas-payment] ← busca preços + valida cupom do DB
```

### Mudanças

**1. Migration SQL — 3 novas tabelas**

**`plan_pricing`** — fonte única de verdade para preços
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| tier | text (unique combo com cycle) | starter, premium, enterprise |
| cycle | text | monthly, annual |
| price | integer | Preço em centavos (ex: 7900 = R$79) |
| credits | integer | Créditos concedidos |
| max_projects | integer | -1 = ilimitado |
| active | boolean | default true |
| updated_at | timestamptz | |

- RLS: SELECT público (frontend precisa ler), ALL para admins
- Seed com os preços atuais

**`coupons`** — cupons de desconto
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| code | text UNIQUE | Código (ex: GRAVYX20) |
| discount_type | text | percent ou fixed |
| discount_value | numeric | 20 = 20% ou 5000 = R$50 (centavos) |
| max_uses | integer nullable | null = ilimitado |
| current_uses | integer default 0 | |
| valid_until | timestamptz nullable | null = sem expiração |
| allowed_tiers | text[] nullable | null = todos |
| allowed_cycles | text[] nullable | null = todos |
| active | boolean default true | |
| created_at | timestamptz | |

- RLS: SELECT público (validação no checkout), ALL para admins

**`coupon_usages`** — controle de uso por usuário
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| coupon_id | uuid FK → coupons | |
| user_id | uuid | |
| used_at | timestamptz default now() | |

- Unique constraint em (coupon_id, user_id)
- RLS: INSERT/SELECT próprio, ALL para admins

**2. Nova seção no Admin: "Preços & Cupons"**

Adicionar `'pricing'` ao tipo `AdminSection` em `AdminContext.tsx` e ao `AdminSidebar.tsx` (ícone DollarSign, já importado).

Novo componente `src/components/admin/pricing/PricingTab.tsx` com duas sub-abas:

- **Preços dos Planos**: Tabela editável inline com os 6 registros (3 tiers x 2 cycles). Campos: tier, cycle, preço (R$), créditos, max projetos. Botão salvar por linha.
- **Cupons de Desconto**: Tabela com CRUD completo. Criar cupom (modal com campos: código, tipo desconto, valor, limite de usos, validade, tiers/cycles permitidos). Editar, ativar/desativar, excluir.

**3. Frontend — buscar preços do DB**

- `src/components/BuyCreditsModal.tsx`: substituir o array `plans` hardcoded por uma query `useQuery` que busca `plan_pricing` e monta os dados dinamicamente.
- `src/pages/Checkout.tsx`: substituir `PLAN_PRICING` hardcoded pela mesma query.
- `src/components/AsaasTransparentCheckout.tsx`: adicionar campo de cupom opcional (input + botão "Aplicar"). Ao aplicar, faz query na tabela `coupons` para validar e mostrar preço com desconto. Envia `couponCode` no payload.

**4. Edge Function — `process-asaas-payment`**

- Substituir o objeto `PRICING` hardcoded por uma query ao `plan_pricing` usando `supabaseAdmin`.
- Receber campo opcional `couponCode`, validar server-side (existe, ativo, validade, uso, tier/cycle), calcular `finalValue`, criar cobrança com valor reduzido.
- Após pagamento confirmado, registrar uso em `coupon_usages` e incrementar `current_uses`.
- Créditos não mudam com cupom (desconto é apenas no preço).

**5. Atualizar `src/lib/plan-limits.ts`**

- Manter como fallback/tipos, mas os valores reais vêm do DB.

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL (plan_pricing + coupons + coupon_usages + seed) | Criar |
| `src/components/admin/AdminContext.tsx` | Modificar — adicionar 'pricing' ao AdminSection |
| `src/components/admin/AdminSidebar.tsx` | Modificar — adicionar item "Preços & Cupons" |
| `src/components/admin/pricing/PricingTab.tsx` | Criar — gestão de preços e cupons |
| `src/pages/Admin.tsx` | Modificar — renderizar PricingTab |
| `src/components/BuyCreditsModal.tsx` | Modificar — buscar preços do DB |
| `src/pages/Checkout.tsx` | Modificar — buscar preços do DB |
| `src/components/AsaasTransparentCheckout.tsx` | Modificar — campo de cupom |
| `supabase/functions/process-asaas-payment/index.ts` | Modificar — preços do DB + validação de cupom |

