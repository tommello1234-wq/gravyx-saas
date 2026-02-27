

## Plano: Dashboard Unificado com Filtros por Visão e Resolução

### Problema atual
1. O `useAdminDashboard` busca jobs **sem o campo `payload`**, então não temos dados de resolução (1K/2K/4K)
2. O gráfico principal ("Visão Financeira") só mostra dados financeiros, sem opção de ver operacional ou usuários
3. Não existe filtro por resolução de imagem
4. Os dados de custo não consideram resoluções diferentes (2K custa mais que 1K)

### Alterações

**1. `useAdminDashboard.ts` - Buscar payload dos jobs e calcular métricas por resolução**
- Adicionar `payload` ao select de jobs para extrair resolução
- Criar novos campos no `DashboardData`:
  - `imagesByResolution: { '1K': number, '2K': number, '4K': number }` (no período)
  - `imagesByResolutionByDay: { date: string, '1K': number, '2K': number, '4K': number }[]`
- Ajustar cálculo de custo para considerar custo diferenciado por resolução ($0.067 para 1K, $0.101 para 2K, $0.151 para 4K)
- Usar o campo `result_count` dos jobs para contagem mais precisa de imagens reais vs jobs

**2. `AdminContext.tsx` - Adicionar filtro de resolução**
- Novo estado `resolutionFilter: 'all' | '1K' | '2K' | '4K'`

**3. `AdminTopbar.tsx` - Dropdown de resolução**
- Novo Select para filtrar por resolução (Todas / 1K / 2K / 4K)

**4. `RevenueChart.tsx` - Gráfico principal multi-visão**
- Trocar tabs de `overview | profit` para 3 visões principais:
  - **Financeiro**: Receita × Custos × Lucro (como está hoje)
  - **Operacional**: Imagens geradas por dia, breakdown por resolução (áreas empilhadas 1K/2K/4K)
  - **Usuários**: Novos usuários × Usuários ativos por dia
- Manter o gráfico de pizza ao lado (distribuição por plano)

**5. `FinancialDashboard.tsx` - Passar dados de resolução**
- Propagar o filtro de resolução e os novos dados para os componentes

**6. `FinancialKPIs.tsx` - KPI de resolução**
- Adicionar mini-indicador mostrando breakdown de imagens por resolução no período (ex: "1K: 54 | 2K: 1 | 4K: 3")

### Detalhe técnico

```text
Gráfico Principal - 3 Visões:

[Financeiro]  [Operacional]  [Usuários]

Financeiro:   Receita + Custos + Lucro (como hoje)
Operacional:  Stacked Areas → 1K / 2K / 4K por dia
Usuários:     Novos + Ativos por dia

Filtro de resolução no topbar filtra os dados
de imagens em todo o dashboard.
```

Custos por resolução usados nos cálculos:
- 1K → $0.067
- 2K → $0.101  
- 4K → $0.151

