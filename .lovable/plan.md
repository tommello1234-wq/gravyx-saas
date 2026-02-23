
## Corrigir Bug: Valores Financeiros Salvos em Reais ao Inves de Centavos

### Problema
O banco de dados `credit_purchases.amount_paid` espera valores em **centavos** (padrao herdado da Ticto: 7900 = R$ 79,00). Porem, tanto o `process-asaas-payment` quanto o `asaas-webhook` salvam o valor em **reais** (420 ao inves de 42000), causando distorcao em todas as metricas financeiras do dashboard.

### Evidencia
| Transacao | amount_paid salvo | Valor correto (centavos) |
|-----------|-------------------|--------------------------|
| Asaas Starter Anual (PIX) | 420 | 42000 |
| Ticto Starter Mensal | 7900 | 7900 (correto) |

### Correcoes

**1. `supabase/functions/process-asaas-payment/index.ts`**

O `PRICING` define valores em reais inteiros (79, 420, etc). Ao salvar no `credit_purchases`, multiplicar `totalValue` por 100:

- Linha ~183: `amount_paid: totalValue` → `amount_paid: totalValue * 100`
- Linha ~260: `amount_paid: totalValue` → `amount_paid: totalValue * 100`

**2. `supabase/functions/asaas-webhook/index.ts`**

O Asaas envia `payment.value` em reais (ex: 420.00). Ao salvar no `credit_purchases`, multiplicar por 100:

- Linha ~207: `amount_paid: (payment.value as number) || 0` → `amount_paid: Math.round(((payment.value as number) || 0) * 100)`

**3. Corrigir o registro existente no banco**

Atualizar a compra ja registrada com o valor correto:

```sql
UPDATE credit_purchases 
SET amount_paid = 42000 
WHERE transaction_id = 'pay_9d2e6cz6uzkg1q1h';
```

### Resultado
- O valor da sua compra de teste passara a mostrar R$ 420,00 corretamente
- Todas as futuras transacoes via Asaas serao salvas em centavos, consistente com os dados da Ticto
- As metricas do dashboard financeiro (Receita, MRR, Lucro, Margem) refletirao valores reais
