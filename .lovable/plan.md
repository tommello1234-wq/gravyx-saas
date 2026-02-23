

## Reestruturar Dashboard Admin - Financeiro + Operacional Separados

### Arquitetura: 2 Dashboards na Sidebar

Em vez de misturar tudo, vamos criar 2 itens na sidebar:

- **Financeiro** (icone DollarSign) - Tudo sobre dinheiro, custos, lucro, margem
- **Operacional** (icone LayoutDashboard) - Usuarios, crescimento, uso, conversao

Isso segue o padrao de SaaS B2B como Stripe Dashboard, Baremetrics, ChartMogul.

---

### 1. Dashboard Financeiro (NOVO)

#### Linha 1 - KPIs Hero (cards grandes, destaque maximo)

6 cards com tipografia grande e indicadores de tendencia:

| KPI | Calculo | Visual |
|-----|---------|--------|
| Receita Total | Soma de `credit_purchases.amount_paid` no periodo | Verde |
| MRR Atual | Soma dos precos mensais de assinantes ativos (anual / 12) | Azul |
| Custos Totais | Variaveis + fixos | Vermelho |
| Lucro Liquido | Receita - Custos Totais | Verde se positivo, vermelho se negativo |
| Margem de Lucro | (Lucro / Receita) * 100 | Mesma logica de cor |
| Churn Rate | Cancelados / (Ativos + Cancelados) | Vermelho se > 5% |

Cada card mostra: valor, percentual de variacao vs periodo anterior, seta para cima/baixo colorida.

#### Linha 2 - Grafico Principal (dominante, ~350px altura)

Grafico de area/linha com 3 series simultaneas:
- **Receita** (verde)
- **Custos** (vermelho)
- **Lucro** (azul)

Tabs para alternar entre:
- Receita vs Custos vs Lucro (padrao)
- Evolucao do MRR
- Evolucao do Lucro isolado

#### Linha 3 - Bloco de Custos (editavel)

Card com tabela editavel inline:

**Custos Variaveis:**
- Custo por geracao de imagem (R$ por unidade) - editavel
- Taxa da plataforma de pagamento (% sobre receita) - editavel
- Imposto (% sobre receita) - editavel
- Outros custos variaveis (valor fixo mensal) - editavel

**Custos Fixos Mensais:**
- Lista com nome + valor, com botao de adicionar/remover
- Ex: "Supabase Pro - R$ 125", "Dominio - R$ 50"

Totais calculados automaticamente:
- Total custos variaveis (baseado na receita e uso do periodo)
- Total custos fixos
- **Total geral de custos**

Valores salvos em `localStorage` para persistir entre sessoes.

#### Linha 4 - Bloco de Assinaturas

Cards + mini tabela:
- Assinantes ativos
- Novas assinaturas (periodo)
- Cancelamentos (periodo)
- Receita perdida por churn
- ARPU (receita / assinantes ativos)

Tabela por plano: Starter | Premium | Enterprise com colunas de assinantes, receita, churn.

#### Linha 5 - Metricas Estrategicas

Cards menores:
- LTV estimado (ARPU / churn rate mensal)
- Receita projetada proximo mes (MRR + tendencia)
- Break-even (custos fixos / ARPU = quantos assinantes preciso)
- Crescimento MRR (% vs periodo anterior)

---

### 2. Dashboard Operacional (refatorar o atual)

Manter o conteudo atual do StrategicDashboard mas reorganizado como "Operacional":
- Crescimento de usuarios
- Conversao e funil
- Uso e consumo de creditos
- Top consumidores
- Performance da plataforma (jobs, erros)

---

### Arquivos a criar/modificar

**Criar:**
- `src/components/admin/financial/FinancialDashboard.tsx` - Componente principal do dashboard financeiro
- `src/components/admin/financial/FinancialKPIs.tsx` - Linha 1: 6 cards hero
- `src/components/admin/financial/RevenueChart.tsx` - Linha 2: Grafico principal grande
- `src/components/admin/financial/CostsManager.tsx` - Linha 3: Custos editaveis com localStorage
- `src/components/admin/financial/SubscriptionsBlock.tsx` - Linha 4: Metricas de assinaturas
- `src/components/admin/financial/StrategicMetrics.tsx` - Linha 5: LTV, break-even, projecoes

**Modificar:**
- `src/components/admin/AdminContext.tsx` - Adicionar 'financial' ao tipo AdminSection
- `src/components/admin/AdminSidebar.tsx` - Adicionar item "Financeiro" na sidebar com icone DollarSign
- `src/pages/Admin.tsx` - Adicionar case 'financial' no switch renderContent
- `src/components/admin/dashboard/useAdminDashboard.ts` - Adicionar campos para custos detalhados (taxa plataforma, imposto, custos fixos)

**Renomear conceitual:**
- O item "Dashboard" na sidebar passa a ser "Operacional" (reutiliza StrategicDashboard)
- O novo item "Financeiro" fica acima na sidebar (prioridade)

---

### Detalhes tecnicos

**Custos editaveis com localStorage:**
```text
Interface CostConfig:
  - costPerImage: number (R$)
  - paymentFeePercent: number (%)
  - paymentFeeFixed: number (R$)
  - taxPercent: number (%)
  - otherVariableCosts: number (R$)
  - fixedCosts: { name: string; value: number }[]
```

Salvo em `localStorage` com key `gravyx-admin-costs`. Valores carregados no mount e atualizados em tempo real.

**Calculos financeiros:**
- Custos variaveis = (imagens * custoUnitario) + (receita * taxaPlataforma%) + (receita * imposto%) + outrosVariaveis
- Custos totais = variaveis + soma(fixos)
- Lucro = Receita - Custos totais
- Margem = (Lucro / Receita) * 100
- LTV = ARPU / (churnRate / 100) -- se churn > 0
- Break-even = soma(fixos) / ARPU

**Visual:**
- Cards KPI com gradiente sutil e sombra
- Cores semanticas: verde lucro, vermelho custo/prejuizo, azul MRR
- Indicadores de tendencia com setas e percentual colorido
- Grafico principal com altura generosa (~350px) e legenda clara
- Inputs de custo com estilo inline clean (sem modais)
- Totalmente responsivo com grid colapsavel em mobile

**Filtros:**
Os filtros globais existentes (periodo, plano) ja funcionam e serao reutilizados no dashboard financeiro via `useAdminContext`.

Nenhuma mudanca no banco de dados -- tudo frontend.
