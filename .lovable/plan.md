

# Adicionar Custo Operacional Estimado ao Admin Dashboard

## O que sera feito

Adicionar uma constante de custo por imagem e exibir no painel admin o custo operacional estimado da plataforma, para que voce tenha visibilidade de quanto esta gastando com geracao de imagens.

## Alteracoes

### 1. Constante de custo em `src/lib/plan-limits.ts`
- Adicionar `ESTIMATED_COST_PER_IMAGE_USD = 0.06` (media estimada por imagem usando Gemini Pro)
- Adicionar `USD_TO_BRL_RATE = 5.80` (taxa de conversao aproximada)

### 2. Novos KPIs no dashboard (`useAdminDashboard.ts`)
- Calcular `estimatedOperationalCost` = total de imagens x custo por imagem
- Calcular `periodOperationalCost` = imagens do periodo x custo por imagem  
- Calcular `profitMargin` = receita total - custo operacional estimado

### 3. Novos cards de KPI (`KpiCards.tsx`)
- **Custo Operacional**: mostra o custo estimado total em USD e BRL
- **Margem Estimada**: mostra receita menos custo operacional (lucro/prejuizo)

Os dois novos cards serao adicionados ao grid existente de KPIs, mantendo o mesmo visual (glass-card, icones, growth indicator).

## Detalhes tecnicos

- A constante fica centralizada em `plan-limits.ts` para facil ajuste quando voce tiver o valor real
- O calculo e simples: `totalImages * ESTIMATED_COST_PER_IMAGE_USD`
- Os valores serao exibidos em USD com conversao para BRL ao lado
- O card de margem mostrara verde (positivo) ou vermelho (negativo)
- Nenhuma alteracao de banco de dados necessaria

