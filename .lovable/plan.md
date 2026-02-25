

## Cupom Válido Apenas na Primeira Cobrança

### Problema
Atualmente, quando um cupom é aplicado a uma assinatura recorrente (CASE 2), a subscription no Asaas é criada com `value: finalValue` (valor já com desconto). Isso faz com que **todas** as cobranças futuras usem o mesmo valor descontado. O cupom deveria valer apenas na primeira cobrança.

### Solução
Criar a assinatura no Asaas sempre com o **valor cheio** (`priceReais`), e aplicar o desconto apenas na primeira cobrança usando a API de update do pagamento individual. Após a subscription ser criada e a primeira cobrança gerada, atualizamos o valor dessa primeira cobrança via `PUT /v3/payments/{id}` com o `finalValue`.

### Mudanças

**`supabase/functions/process-asaas-payment/index.ts`** — Modificar CASE 2 (subscriptions)

1. Criar a subscription com `value: priceReais` (valor cheio) em vez de `finalValue`
2. Após buscar a primeira cobrança (`/v3/subscriptions/{id}/payments`), se houver cupom aplicado, atualizar o valor dessa cobrança individual via `PUT /v3/payments/{firstPayment.id}` com `value: finalValue`
3. A partir da segunda cobrança, o Asaas cobra automaticamente o `value` da subscription (valor cheio)

Fluxo resultante:
```text
Subscription criada: value = R$79 (cheio)
1ª cobrança: PUT value = R$63,20 (com cupom 20%)
2ª cobrança em diante: R$79 (automático pelo Asaas)
```

### Detalhes técnicos

A API do Asaas permite alterar o valor de um pagamento individual via `PUT /v3/payments/{id}` com `{ value: novoValor }`, desde que o pagamento ainda esteja pendente. Isso é seguro porque a primeira cobrança acaba de ser criada e ainda não foi paga.

O CASE 1 (annual + credit card, cobrança avulsa) não precisa de alteração pois já é um pagamento único sem recorrência.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/process-asaas-payment/index.ts` | Modificar — subscription com valor cheio + desconto apenas na 1ª cobrança |

