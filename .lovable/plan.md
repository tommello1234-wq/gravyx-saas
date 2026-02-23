

## Unificar Dashboard Admin - Layout Redesenhado

### Problema atual
O dashboard esta dividido em "Financeiro" e "Operacional" com informacao redundante (receita/lucro aparece nos dois). O visual dos KPIs tem numeros grandes demais, falta lista de transacoes recentes, o funil de conversao e visualmente feio, e o grafico de distribuicao por plano deveria ser pizza ao lado do grafico principal.

### Mudanca principal
Eliminar a secao "Operacional" e unificar tudo em um unico **Dashboard** com hierarquia clara e sem redundancia.

---

### Nova estrutura do Dashboard unificado

#### 1. KPIs Hero (numeros menores, mais compactos)
- Receita Total, MRR, Custos Totais, Lucro Liquido, Margem, Churn Rate
- Reduzir tamanho da fonte de `text-2xl lg:text-3xl` para `text-xl lg:text-2xl`
- Reduzir padding dos cards

#### 2. Gestao de Custos (mover para ACIMA do grafico)
- Manter o collapsible atual mas posiciona-lo antes do grafico principal
- Qualquer alteracao nos custos reflete imediatamente no grafico abaixo

#### 3. Grafico Principal + Pizza de Planos (lado a lado)
- Layout: grafico de area (70% largura) + pie chart de distribuicao por plano (30% largura)
- Pie chart mostra quantos assinantes por plano (Starter, Premium, Enterprise) - excluir "free" do pie
- Em mobile: empilha verticalmente

#### 4. Ultimas Transacoes (NOVO)
- Tabela com as ultimas 10-15 transacoes do periodo
- Colunas: Data, Email do usuario, Plano, Valor (R$), Gateway (Ticto/Asaas)
- Dados vindos de `credit_purchases` ja disponivel no hook

#### 5. Assinaturas (manter como esta)
- Ativos, Novas, Cancelamentos, Receita perdida, ARPU
- Tabela por plano

#### 6. Metricas Estrategicas (manter como esta)
- LTV, Receita Projetada, Break-even, Crescimento MRR

#### 7. Bloco Operacional (integrado, sem redundancia)
- **Crescimento**: Total usuarios, Novos (periodo), Pagos ativos (SEM "Trials Ativos")
- **Conversao**: KPIs simplificados (SEM o funil de barras feio) - usar cards simples
- **Uso**: Creditos consumidos, Media/usuario, Saldo zero (SEM "Top consumidor")
- Remover grafico de crescimento de usuarios (redundante com o grafico principal)

---

### Sidebar
- Remover item "Operacional" da sidebar
- "Dashboard" vira o item principal (antigo "Financeiro" + "Operacional" unificados)
- Manter: Dashboard, Usuarios, Biblioteca, Templates, Configuracoes

---

### Arquivos a modificar

**Modificar:**
- `src/components/admin/financial/FinancialDashboard.tsx` - Adicionar transacoes recentes, reordenar blocos (custos antes do grafico), integrar metricas operacionais
- `src/components/admin/financial/FinancialKPIs.tsx` - Reduzir tamanho dos numeros
- `src/components/admin/financial/RevenueChart.tsx` - Adicionar pie chart ao lado do grafico principal
- `src/components/admin/AdminSidebar.tsx` - Remover "Operacional", renomear "Financeiro" para "Dashboard"
- `src/components/admin/AdminContext.tsx` - Remover 'dashboard' do tipo AdminSection (ou reusar como unico)
- `src/pages/Admin.tsx` - Remover case 'dashboard' com StrategicDashboard

**Criar:**
- `src/components/admin/financial/RecentTransactions.tsx` - Tabela de ultimas transacoes

**Nao deletar mas deixar de usar:**
- `src/components/admin/strategic/StrategicDashboard.tsx` e sub-componentes (GrowthBlock, ConversionBlock, RevenueBlock, UsageCostBlock) - nao serao mais referenciados

---

### Detalhes visuais

**KPIs menores:**
- Fonte principal: `text-xl lg:text-2xl` (era `text-2xl lg:text-3xl`)
- Padding: `p-4` (era `p-5`)
- Icone: `h-8 w-8` (era `h-9 w-9`)

**Grafico + Pizza lado a lado:**
```text
+-------------------------------+----------------+
|  Grafico Area (Receita/Custo) |  Pie Chart     |
|  350px altura                 |  Distribuicao  |
|  Tabs: Overview | Lucro       |  por Plano     |
+-------------------------------+----------------+
```

**Transacoes recentes:**
```text
| Data       | Usuario              | Plano   | Valor     | Gateway |
|------------|----------------------|---------|-----------|---------|
| 23/02/2026 | wash...@gmail.com    | Starter | R$ 420,00 | Asaas   |
| 15/01/2026 | taia...@gmail.com    | Starter | R$ 79,00  | Ticto   |
```

**Bloco operacional integrado:**
- 1 card simples com grid de mini-KPIs (sem graficos separados)
- Total usuarios, Novos, Pagos ativos, Creditos consumidos, Media/usuario, Saldo zero
- Sem funil, sem top consumidor, sem trials

