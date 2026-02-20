
## Adicionar custo por imagem como primeiro bullet point em cada plano

### O que sera feito

Adicionar um novo campo `costPerImage` ao tipo `PlanInfo` com valores para mensal e anual, e inserir como primeiro item da lista de features de cada plano.

### Valores

| Plano | Mensal | Anual |
|-------|--------|-------|
| Starter | R$0,98 | R$0,42 |
| Premium | R$0,67 | R$0,37 |
| Enterprise | R$0,57 | R$0,32 |

### Alteracao tecnica

**Arquivo:** `src/components/BuyCreditsModal.tsx`

1. Adicionar ao tipo `PlanInfo` os campos `costPerImageMonthly` e `costPerImageAnnual` (strings)
2. Preencher nos dados de cada plano:
   - Starter: `'R$0,98'` / `'R$0,42'`
   - Premium: `'R$0,67'` / `'R$0,37'`
   - Enterprise: `'R$0,57'` / `'R$0,32'`
3. Na renderizacao da lista `ul` de features (~linha 127), inserir antes do map um `li` adicional com o texto `"Apenas {valor} por imagem"`, escolhendo o valor com base no `cycle`

### Resultado visual

Cada card de plano tera como primeiro bullet:

- **Apenas R$0,98 por imagem** (Starter mensal)
- **Apenas R$0,42 por imagem** (Starter anual)
- etc.

Seguido dos bullets existentes (creditos, projetos, templates...).
