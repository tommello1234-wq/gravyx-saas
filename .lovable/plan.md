

# Dashboard Admin Visual e Estrategico

## Resumo

Transformar a aba "Usuarios" do Admin em um dashboard completo com metricas visuais, graficos e tabela avancada, e adicionar uma nova aba "Dashboard" como a primeira aba. As abas "Biblioteca" e "Templates" permanecem inalteradas.

## Sobre as limitacoes de dados

Voce esta certo: para usuarios existentes que ja usaram a plataforma, os dados de `generations` e `jobs` ja existem com timestamps, entao as metricas serao calculadas a partir deles. O campo `last_sign_in_at` ja existe no `auth.users` do Supabase e pode ser acessado pela edge function `admin-users`. A unica metrica que nao teremos com precisao historica e o consumo exato de creditos por usuario (so temos saldo atual + compras), mas daqui pra frente tudo sera rastreado.

## Estrutura de Arquivos Novos

```text
src/components/admin/dashboard/
  DashboardTab.tsx          -- Container principal
  KpiCards.tsx              -- Cards de metricas no topo
  ActivityChart.tsx         -- Grafico principal de atividade
  PlanDistribution.tsx      -- Distribuicao por plano (donut)
  TopUsersRanking.tsx       -- Ranking top 10
  PlatformPerformance.tsx   -- Secao colapsavel de performance
  AlertsBanner.tsx          -- Alertas automaticos
  useAdminDashboard.ts      -- Hook centralizado para queries
```

## Arquivos Modificados

- `src/pages/Admin.tsx` -- Adicionar aba "Dashboard", extrair tabela de usuarios para componente melhorado
- `supabase/functions/admin-users/index.ts` -- Adicionar action `dashboard-stats` para retornar dados agregados que o admin precisa (contagens de generations, jobs, dados de auth.users como last_sign_in)

## Migracao SQL

Adicionar policy de SELECT para admin na tabela `generations` e `jobs` (para que o admin possa ver dados de todos os usuarios no client-side):

```sql
CREATE POLICY "generations_admin_select" ON generations
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "jobs_admin_select" ON jobs
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
```

## Detalhes Tecnicos

### 1. Hook useAdminDashboard.ts

Hook centralizado com React Query que busca:
- `profiles` (todos, via RLS admin)
- `generations` (todas, apos nova policy)
- `jobs` (todos, apos nova policy)
- `credit_purchases` (todas, via RLS admin)
- Dados de auth via edge function (last_sign_in_at dos usuarios)

Calcula todas as metricas derivadas:
- Total de usuarios, ativos (30d), imagens geradas, creditos consumidos estimados
- Agrupamentos por dia/semana/mes para graficos
- Rankings, distribuicao por plano, alertas

Aceita parametro de periodo (7d, 30d, 90d, 12m) e faz refetch automatico a cada 60s.

### 2. KpiCards.tsx -- Metricas Principais

6 cards no topo em grid responsivo (2 colunas mobile, 3 desktop):
- Total de usuarios (com icone Users)
- Usuarios ativos 30d (com % do total)
- Total de imagens geradas
- Creditos consumidos (estimativa: creditos_iniciais + comprados - saldo_atual)
- Receita total (sum de credit_purchases.amount_paid)
- Taxa de atividade (% usuarios que geraram pelo menos 1 imagem)

Cada card: numero grande, icone, indicador de crescimento vs periodo anterior, mini sparkline com Recharts AreaChart.

Skeleton loading enquanto carrega.

### 3. ActivityChart.tsx -- Grafico Principal

- Recharts AreaChart responsivo com gradiente
- Filtros de periodo: 7d / 30d / 90d / 12m (botoes toggle)
- Toggle para alternar metrica: Imagens geradas / Novos usuarios / Creditos consumidos
- Dados agrupados por dia (7d/30d/90d) ou por mes (12m)
- Tooltip customizado com estilo dark

### 4. PlanDistribution.tsx

- Recharts PieChart (donut) mostrando usuarios por tier
- Labels com quantidade e percentual
- Cores do design system (primary, secondary, accent)

### 5. TopUsersRanking.tsx

- Top 10 usuarios por imagens geradas
- Colunas: posicao (com badge ouro/prata/bronze), nome/email, plano, total imagens, creditos atuais
- Filtro por periodo integrado com o filtro global
- Dados calculados a partir de `generations` agrupados por user_id

### 6. PlatformPerformance.tsx

- Secao colapsavel (Collapsible)
- Metricas de `jobs`: total processados, com erro (24h), taxa de sucesso
- Cards menores em grid

### 7. AlertsBanner.tsx

- Alertas baseados em regras calculadas no frontend:
  - Pico de uso (geracao diaria > 2x media)
  - Aumento de erros (jobs com error > 10% nas ultimas 24h)
  - Usuarios com 0 creditos
- Exibidos como banners coloridos no topo do dashboard

### 8. Tabela de Usuarios Melhorada

Dentro da aba "Usuarios" existente, melhorar a tabela atual com:
- Campo de busca por nome/email
- Filtro por plano (Select)
- Colunas adicionais: imagens geradas, ultimo acesso
- Paginacao client-side (20 por pagina)
- Botao exportar CSV
- Ordenacao por coluna clicavel
- Manter todas as funcionalidades existentes (editar creditos, reenviar convite, remover)

### 9. Edge Function admin-users

Adicionar nova action `dashboard-stats` que retorna:
- Lista de user IDs com `last_sign_in_at` do `auth.users` (via supabaseAdmin.auth.admin.listUsers)
- Isso permite mostrar "ultimo login" na tabela e calcular retencao

Adicionar `dashboard-stats` ao array `validActions`.

### 10. Layout do Dashboard

```text
+------------------------------------------+
| [Alertas Banner]                         |
+------------------------------------------+
| [KPI 1] [KPI 2] [KPI 3]                |
| [KPI 4] [KPI 5] [KPI 6]                |
+------------------------------------------+
| [Grafico de Atividade]          [Donut] |
| [Area chart grande]            [Planos] |
+------------------------------------------+
| [Top 10 Ranking]                        |
+------------------------------------------+
| > Performance da Plataforma (colapsavel)|
+------------------------------------------+
```

### 11. UX

- Skeleton loading em todos os componentes
- Animacoes suaves com classes Tailwind (animate-fade-in)
- Auto-refresh a cada 60s via refetchInterval do React Query
- Layout responsivo: 1 coluna em mobile, multi-coluna em desktop
- Estilo dark mode usando as variaveis CSS do Blue Orbital Design System (glass-card, etc.)

### 12. Abas Finais

A ordem das abas no Admin ficara:
1. Dashboard (nova, default)
2. Biblioteca (inalterada)
3. Templates (inalterada)
4. Usuarios (tabela melhorada)

