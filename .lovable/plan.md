

# Reestruturacao Completa do Admin Panel

## Visao Geral

Transformar o admin atual (baseado em tabs) em um painel completo com sidebar, topbar com filtros globais, e dois dashboards separados: Operacao/Usuarios e Financeiro. O layout atual sera totalmente reorganizado.

## Limitacoes de Dados Atuais

Antes de detalhar, e importante notar que **nao existem tabelas de assinaturas ou eventos de subscription** no banco. Os dados disponiveis sao:
- `profiles` (tier, credits, billing_cycle, created_at)
- `generations` (imagens geradas por usuario)
- `jobs` (fila de processamento)
- `credit_purchases` (compras de creditos)

Metricas como "churn", "cancelamentos", "renovacoes" e "ativacoes por plano" serao **estimadas** com base nos dados existentes ou exibidas como "N/A" ate que um sistema de assinaturas seja implementado. MRR/ARR serao estimados com base nos planos ativos e precos configurados.

---

## Estrutura de Arquivos

```text
src/
  pages/
    Admin.tsx                          -- Refatorado: layout com sidebar + outlet
  components/
    admin/
      AdminLayout.tsx                  -- Sidebar + Topbar + Content area
      AdminSidebar.tsx                 -- Navegacao lateral
      AdminTopbar.tsx                  -- Busca, filtros periodo/plano, exportar
      AdminContext.tsx                 -- Context para filtros globais (periodo, plano, busca)
      TemplatesTab.tsx                 -- (existente, sem alteracao)
      operations/
        OperationsDashboard.tsx        -- Dashboard 1 completo
        OperationsKpiCards.tsx         -- KPIs de operacao (6 cards)
        UsageCards.tsx                 -- Cards de uso do produto (5 cards)
        ImagesPerDayChart.tsx          -- Grafico linha: imagens/dia
        CreditsPerDayChart.tsx         -- Grafico linha: creditos/dia
        PlanDistributionChart.tsx      -- Grafico barras: usuarios por plano
        TopTemplatesChart.tsx          -- Grafico barras: templates mais usados
        OperationsUsersTable.tsx       -- Tabela detalhada de usuarios
        UserProfileModal.tsx           -- Modal com historico completo do usuario
      financial/
        FinancialDashboard.tsx         -- Dashboard 2 completo
        FinancialSettings.tsx          -- Configuracao custo/imagem, taxa gateway, imposto
        FinancialKpiCards.tsx          -- KPIs financeiros (6 cards)
        RevenuePerDayChart.tsx         -- Grafico linha: faturamento/dia
        CostPerDayChart.tsx           -- Grafico linha: custo/dia
        ProfitPerDayChart.tsx         -- Grafico linha: lucro/dia
        RevenueByPlanChart.tsx        -- Barras empilhadas: receita por plano
        CostByPlanChart.tsx           -- Barras: custo por plano
        RevenuePieChart.tsx           -- Pizza: participacao receita por plano
        FinancialTable.tsx            -- Tabela financeira por plano
      dashboard/
        useAdminDashboard.ts           -- Refatorado: expandir com dados financeiros
        AlertsBanner.tsx               -- (existente, reutilizado)
```

---

## Alteracoes Detalhadas

### 1. AdminContext (novo)

Context global que armazena:
- `period`: 'today' | '7d' | '30d' | '90d' | 'custom'
- `customRange`: { start: Date, end: Date } (para filtro custom)
- `tierFilter`: 'all' | 'free' | 'starter' | 'creator' | 'enterprise'
- `searchQuery`: string (busca por usuario)

Todos os dashboards e tabelas consomem este context para filtrar dados.

### 2. AdminLayout (novo)

Layout principal com:
- Sidebar fixa a esquerda (colapsavel)
- Topbar no topo com filtros globais
- Area de conteudo que renderiza o dashboard ativo

Usara estado local para controlar qual secao esta ativa (sem necessidade de rotas adicionais -- mantemos `/admin` como rota unica com navegacao interna via estado).

### 3. AdminSidebar (novo)

Itens de navegacao:
- Dashboard (Operacao) -- icone BarChart3
- Dashboard (Financeiro) -- icone DollarSign
- Usuarios -- icone Users
- Biblioteca -- icone Images
- Templates -- icone LayoutTemplate
- Configuracoes -- icone Settings

Visual: fundo escuro com glassmorphism, itens com hover e indicador ativo em ciano. Colapsavel para modo mini (apenas icones).

### 4. AdminTopbar (novo)

Contem:
- Campo de busca (nome/email/id)
- Seletor de periodo (Hoje, 7d, 30d, 90d, Custom com date picker)
- Seletor de plano (Todos, Free, Starter, Creator, Enterprise)
- Botao "Exportar CSV" (contextual, aparece em tabelas)

### 5. useAdminDashboard (refatorado)

Expandir o hook existente para incluir:
- Filtro por tier (recebe do context)
- Filtro "today" alem dos existentes
- Dados financeiros por plano (faturamento, custo, lucro agrupado por tier)
- Dados diarios de faturamento (credit_purchases por dia)
- Dados diarios de custo (imagens por dia * custo configuravel)
- MRR/ARR estimados (baseado em planos ativos * preco configurado)
- Media de imagens por usuario ativo
- Creditos restantes (soma dos saldos)
- Contagem de novos usuarios no periodo

### 6. Dashboard Operacao (novo)

**KPI Cards (linha 1 - 6 cards):**
- Usuarios totais (com growth vs periodo anterior)
- Usuarios ativos no periodo (DAU/WAU/MAU conforme filtro)
- Novos usuarios no periodo
- Assinaturas ativas (usuarios com tier != free)
- Ativacoes por plano (novos usuarios pagantes no periodo)
- Churn estimado (usuarios que voltaram para free no periodo)

**Usage Cards (linha 2 - 5 cards):**
- Imagens geradas no periodo
- Creditos consumidos no periodo
- Creditos restantes (soma saldos)
- Media imagens/usuario ativo
- Top usuario (nome + quantidade)

**Graficos (2 colunas):**
- Linha: Imagens geradas por dia
- Linha: Creditos consumidos por dia
- Barras: Distribuicao usuarios por plano
- Barras: Top templates/fluxos mais usados (baseado em project_templates se houver tracking, senao mostra projetos mais ativos)

**Tabela de Usuarios:**
- Colunas: Nome/Email, Plano, Status, Projetos, Imagens (periodo), Creditos consumidos (periodo), Ultimo login, Data assinatura
- Acoes: Ver perfil (modal), Ajustar creditos, Trocar plano
- Exportacao CSV

**Modal Perfil do Usuario:**
- Historico de geracoes (lista com thumbnails e datas)
- Historico de creditos (compras, consumo)
- Lista de projetos
- Status da assinatura e tier atual
- Timeline de mudancas de plano (baseado nos dados disponiveis)

### 7. Dashboard Financeiro (novo)

**Settings (topo - colapsavel):**
- Campo: Custo por imagem em BRL (default: R$ 0,30, armazenado em localStorage)
- Campo: Taxa gateway % (default: 0, desativado)
- Campo: Imposto estimado % (default: 0, desativado)

**KPI Cards (6 cards):**
- Faturamento bruto (periodo) -- soma credit_purchases.amount_paid
- Receita liquida estimada (se gateway ativo)
- Custo de geracao (periodo) -- imagens * custo_por_imagem
- Lucro bruto (periodo) -- faturamento - custo
- Margem % -- (lucro/faturamento) * 100
- MRR estimado -- usuarios pagantes * preco medio mensal

**Graficos (3 linhas + 3 barras):**
- Linha: Faturamento por dia
- Linha: Custo por dia
- Linha: Lucro por dia (faturamento - custo)
- Barras empilhadas: Receita por plano
- Barras: Custo por plano
- Pizza: Participacao de receita por plano

**Tabela Financeira (por plano):**
- Linhas: Free, Starter, Creator, Enterprise
- Colunas: Plano, Assinaturas ativas, Novas (periodo), Cancelamentos (periodo), Faturamento, Imagens geradas, Custo, Lucro, Margem %
- Exportacao CSV

### 8. Pagina Admin.tsx (refatorada)

Substituir o layout atual (Header + Tabs) pelo novo AdminLayout com sidebar. O Header do site sera removido da pagina admin (a sidebar e topbar substituem). Toda a logica de dialogs (criar usuario, deletar, etc) sera mantida e passada como props/callbacks.

---

## Visual e UX

- Manter o estilo glass-card com glassmorphism existente
- Numeros grandes nos KPI cards com variacao % vs periodo anterior
- Cores: ciano para positivo, vermelho para negativo, amarelo para alertas
- Estados vazios com mensagem amigavel em todas as tabelas e graficos
- Sidebar com animacao suave de colapso
- Topbar fixa no topo da area de conteudo
- Responsivo: sidebar colapsa automaticamente em mobile

---

## Dependencias

Nenhuma nova dependencia necessaria. Tudo sera construido com:
- React + TypeScript
- Recharts (graficos ja instalado)
- Radix UI / shadcn (componentes ja instalados)
- date-fns (manipulacao de datas)
- Tailwind CSS (estilizacao)
- localStorage (para configuracoes financeiras como custo/imagem)

---

## Sequencia de Implementacao

1. Criar AdminContext com filtros globais
2. Criar AdminSidebar e AdminTopbar
3. Criar AdminLayout integrando tudo
4. Refatorar useAdminDashboard para suportar novos filtros e dados financeiros
5. Criar Dashboard Operacao com todos os componentes
6. Criar Dashboard Financeiro com todos os componentes
7. Criar UserProfileModal
8. Refatorar Admin.tsx para usar novo layout
9. Mover conteudo de Biblioteca e Templates para dentro do novo layout

