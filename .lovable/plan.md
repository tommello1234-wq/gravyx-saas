

## Corrigir Calculo do MRR

### Problema
O MRR atual tem dois bugs:

1. **Soma TODOS os perfis** - incluindo usuarios free e inativos. Deveria somar apenas quem tem `tier != 'free'` E `subscription_status = 'active'`
2. **Formula errada para planos anuais** - usa `preco_mensal * 0.8` ao inves do preco anual real dividido por 12

Exemplo do erro com formula atual para um Starter anual:
- Atual: R$ 79 x 0.8 = R$ 63,20/mes (ERRADO)
- Correto: R$ 420 / 12 = R$ 35,00/mes

### Precos reais (confirmados no BuyCreditsModal)

| Plano | Mensal | Anual | MRR se anual (anual/12) |
|-------|--------|-------|------------------------|
| Starter | R$ 79 | R$ 420 | R$ 35,00 |
| Premium | R$ 167 | R$ 1.097 | R$ 91,42 |
| Enterprise | R$ 347 | R$ 2.597 | R$ 216,42 |

### Correcao

**Arquivo: `src/components/admin/dashboard/useAdminDashboard.ts`** (linhas 264-270)

Substituir o bloco do MRR por:
- Tabela de precos mensais em centavos: starter=7900, premium=16700, enterprise=34700
- Tabela de precos anuais em centavos: starter=42000, premium=109700, enterprise=259700
- Filtrar apenas perfis com `tier !== 'free'` e `subscription_status === 'active'`
- Se `billing_cycle === 'annual'`: somar `preco_anual / 12` (arredondado)
- Se mensal: somar `preco_mensal`
- ARR = MRR x 12

Nenhuma mudanca visual no KPI card - continua exibindo MRR total e ARR no subtitulo. Sem separacao garantido/estimado.

