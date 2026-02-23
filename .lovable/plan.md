

## Remover opcao de reembolso e limpar codigo

### Contexto
O webhook do Asaas ja trata automaticamente os eventos `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED`, fazendo o downgrade do usuario para free. Nao e necessario ter a opcao de reembolso no painel admin.

### Mudancas

**1. Simplificar `src/components/admin/financial/RecentTransactions.tsx`**
- Remover a opcao "Reembolsar" do menu de 3 pontinhos
- Remover o `AlertDialog` de confirmacao de reembolso
- Remover o state `refundTx` e `isRefunding`
- Remover a funcao `handleRefund`
- Remover a interface `Transaction` do campo `user_id` (nao sera mais necessario)
- Manter as opcoes uteis: "Copiar e-mail" e "Copiar ID transacao"

**2. Remover Edge Function `supabase/functions/admin-refund/index.ts`**
- Deletar o arquivo pois nao sera mais utilizado

**3. Limpar `supabase/config.toml`**
- Remover a entrada `[functions.admin-refund]`

### O que ja funciona (sem mudancas)
O webhook `asaas-webhook` ja processa automaticamente:
- `PAYMENT_REFUNDED`: downgrade para free, creditos zerados
- `PAYMENT_CHARGEBACK_REQUESTED`: mesmo tratamento

Ou seja, ao reembolsar direto no painel do Asaas, o webhook faz o downgrade automaticamente.

