

## Dashboard Estrategico Unificado

### Visao Geral

Substituir as duas abas separadas (Operacao e Financeiro) por um unico dashboard estrategico dividido em 4 blocos visuais. Todos os dados respeitarao o filtro global de periodo do AdminContext (hoje, 7d, 30d, 90d, custom). Remover os seletores de periodo internos dos graficos.

### Estrutura dos 4 Blocos

#### Bloco 1 - CRESCIMENTO
- 5 KPI cards: Total usuarios, Novos (periodo), Trials ativos, Pagos ativos, Distribuicao por plano (mini donut inline)
- 1 grafico de area com seletor de toggle: [Usuarios Totais | Trials | Pagos]
- Dados de trials ativos e pagos ativos ja existem no hook (`subscription_status`)

#### Bloco 2 - CONVERSAO
- 5 KPI cards: Taxa conversao Trial->Pago (%), Trials iniciados (periodo), Conversoes (periodo), Cancelamentos (periodo), Churn real (%)
- Visual de funil horizontal: Usuarios -> Trials -> Pagos -> Ativos
- Calculos novos no hook: contar perfis com `trial_start_date` no periodo, contar perfis que passaram de trial para pago (tier != free AND subscription_status = active AND trial_start_date exists)

#### Bloco 3 - RECEITA & LUCRO
- 6 KPI cards: MRR atual, Receita total (periodo), Custo total (periodo), Lucro liquido (periodo), Margem (%), ARPU
- 1 grafico dinamico com seletor: [Receita | Custo | Lucro | MRR]
- Configuracoes de custo (custo por imagem, gateway, imposto) ficam em collapsible acima

#### Bloco 4 - USO & CUSTO OPERACIONAL
- 5 KPI cards: Creditos consumidos, Media creditos/pago, Media creditos/trial, Top consumidor, Usuarios com saldo 0
- Top 5 consumidores em mini tabela
- Alertas automaticos (banner no topo do dashboard):
  - Conversao Trial->Pago < 5%
  - Mais de 40% dos trials nao consumiram creditos
  - Custo crescendo mais rapido que Receita
  - Margem abaixo de 30%

### O Que Muda

**Sidebar** (`AdminSidebar.tsx`)
- Remover itens "Operacao" e "Financeiro" separados
- Adicionar item unico "Dashboard" como primeira opcao
- Manter Usuarios, Biblioteca, Templates, Configuracoes

**AdminContext** (`AdminContext.tsx`)
- Trocar `AdminSection` para incluir `'dashboard'` em vez de `'operations' | 'financial'`
- Valor padrao do `activeSection` muda para `'dashboard'`

**Hook** (`useAdminDashboard.ts`)
- Adicionar metricas novas ao `DashboardData`:
  - `trialsActive`: perfis com `subscription_status = 'trial_active'`
  - `paidActive`: perfis com `tier != 'free'` e `subscription_status = 'active'`
  - `trialsStartedPeriod`: perfis com `trial_start_date` dentro do periodo
  - `conversionsPeriod`: perfis com `subscription_status = 'active'` e `trial_start_date` (indicando que vieram de trial) criados no periodo
  - `conversionRate`: `conversionsPeriod / trialsStartedPeriod * 100`
  - `churnRate`: estimativa baseada em cancelamentos (perfis que tinham tier pago e voltaram para free no periodo)
  - `arpu`: receita do periodo / usuarios pagos ativos
  - `avgCreditsPerPaid`: creditos consumidos no periodo por usuarios pagos / total pagos
  - `avgCreditsPerTrial`: creditos consumidos no periodo por usuarios trial / total trials
  - `zeroBalanceUsers`: contagem de perfis com credits = 0
  - `trialsWithNoCreditsUsed`: % de trials que nao geraram nenhuma imagem
  - `costGrowthVsRevenue`: comparacao de crescimento custo vs receita

**Novo componente** (`StrategicDashboard.tsx`)
- Componente principal que renderiza os 4 blocos
- Usa o hook `useAdminDashboard` com o periodo global

**Novos sub-componentes:**
- `GrowthBlock.tsx` - Bloco 1
- `ConversionBlock.tsx` - Bloco 2 (inclui visual de funil)
- `RevenueBlock.tsx` - Bloco 3
- `UsageCostBlock.tsx` - Bloco 4
- `StrategicAlerts.tsx` - Banner de alertas estrategicos

**Admin.tsx**
- No `renderContent`, o case `'dashboard'` renderiza `<StrategicDashboard />`
- Remover cases `'operations'` e `'financial'`

### Arquivos Criados
1. `src/components/admin/strategic/StrategicDashboard.tsx`
2. `src/components/admin/strategic/GrowthBlock.tsx`
3. `src/components/admin/strategic/ConversionBlock.tsx`
4. `src/components/admin/strategic/RevenueBlock.tsx`
5. `src/components/admin/strategic/UsageCostBlock.tsx`
6. `src/components/admin/strategic/StrategicAlerts.tsx`

### Arquivos Modificados
1. `src/components/admin/AdminContext.tsx` - atualizar `AdminSection`
2. `src/components/admin/AdminSidebar.tsx` - unificar menu
3. `src/components/admin/dashboard/useAdminDashboard.ts` - adicionar metricas novas
4. `src/pages/Admin.tsx` - trocar rendering para dashboard unico

### Arquivos que Podem Ser Removidos (depois)
- `src/components/admin/operations/OperationsDashboard.tsx`
- `src/components/admin/financial/FinancialDashboard.tsx`
- `src/components/admin/dashboard/DashboardTab.tsx`

### Sem Mudancas no Banco de Dados
Todos os dados necessarios ja existem nas tabelas `profiles`, `generations`, `credit_purchases` e `jobs`.

