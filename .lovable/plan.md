

## Adicionar Receita e Consumo por Usuário na Tabela de Usuários

### Problema
A tabela de usuários no admin mostra apenas créditos atuais e total de imagens, mas não mostra quanto cada usuário já pagou (receita gerada) nem o custo estimado de consumo dele. Isso impede análise individual de rentabilidade.

### Solução
Adicionar duas colunas na tabela de usuários: **Recebido** (total pago pelo usuário) e **Custo** (custo estimado das imagens geradas). Os dados já existem no dashboard (`purchases` e `total_generations`), só precisam ser cruzados e exibidos.

### Mudanças

**`src/components/admin/dashboard/UsersTable.tsx`** — Modificar

- Criar um `Map<user_id, totalPaid>` a partir de `data.purchases`, somando `amount_paid` por `user_id`
- Calcular custo estimado por usuário: `total_generations * costPerImage * 100` (em centavos)
- Adicionar duas novas colunas sortáveis:
  - **Recebido** — total pago pelo usuário em R$ (formatado como `R$ XX,XX`)
  - **Custo** — custo estimado de consumo em R$ (baseado no custo por imagem)
- Adicionar `received` e `cost` como opções de sort
- Atualizar exportação CSV com as novas colunas
- Receber `costPerImage` como prop (já disponível no hook `useAdminDashboard`)

**`src/components/admin/dashboard/DashboardTab.tsx`** — Modificar (se necessário)

- Passar `purchases` e `costPerImage` para o `UsersTable` caso ainda não estejam acessíveis via `data`

### Detalhes técnicos

Os dados de `credit_purchases` já são carregados pelo hook `useAdminDashboard` e estão disponíveis em `data.purchases`. Cada purchase tem `user_id` e `amount_paid` (em centavos). O cruzamento é feito no frontend com um `useMemo` que agrupa por `user_id`.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/admin/dashboard/UsersTable.tsx` | Modificar — adicionar colunas Recebido e Custo |

