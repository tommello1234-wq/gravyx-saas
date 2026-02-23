

## Adicionar Menu de Acoes nas Transacoes Recentes (com Reembolso)

### Visao Geral
Adicionar um menu de 3 pontinhos (kebab) em cada linha da tabela de transacoes recentes com opcoes de acao, sendo a principal o **Reembolso** via API do Asaas.

---

### Fluxo do Reembolso

1. Admin clica nos 3 pontinhos de uma transacao
2. Seleciona "Reembolsar"
3. Aparece um dialogo de confirmacao com os dados da transacao
4. Ao confirmar, chama uma nova Edge Function `admin-refund`
5. A Edge Function:
   - Valida que o usuario e admin
   - Chama a API do Asaas para estornar o pagamento (`POST /v3/payments/{id}/refund`)
   - Faz downgrade do usuario para free (creditos = 0, tier = free, status = inactive)
   - Registra no webhook_logs
6. UI mostra toast de sucesso/erro

---

### Mudancas

**1. Nova Edge Function: `supabase/functions/admin-refund/index.ts`**
- Recebe `{ transactionId, userId }` no body
- Valida JWT do admin via `getClaims()`
- Verifica role admin no banco
- Extrai o payment ID do Asaas (transacoes com `pay_` prefix)
- Chama `POST /v3/payments/{paymentId}/refund` na API do Asaas
- Faz downgrade do perfil: tier=free, credits=0, subscription_status=inactive, asaas_subscription_id=null
- Para transacoes Ticto (sem prefixo `pay_`): apenas faz o downgrade manual (sem chamada de API)

**2. Atualizar `supabase/config.toml`**
- Adicionar configuracao da nova function com `verify_jwt = false`

**3. Atualizar `src/components/admin/financial/RecentTransactions.tsx`**
- Adicionar coluna "Acoes" na tabela
- Cada linha tera um `DropdownMenu` com icone `MoreHorizontal`
- Opcoes do menu:
  - "Reembolsar" (com icone e cor vermelha de alerta)
  - "Copiar e-mail" (copia o email completo para o clipboard)
  - "Copiar ID transacao" (copia o transaction_id)
- Ao clicar em "Reembolsar", abre um `AlertDialog` de confirmacao
- Ao confirmar, chama a Edge Function e exibe toast de resultado
- A interface `Transaction` precisa incluir `user_id` (ja existe na tabela `credit_purchases`)

**4. Atualizar `src/components/admin/dashboard/useAdminDashboard.ts`**
- Incluir `user_id` no select de `credit_purchases` para que o componente tenha acesso ao user_id na hora de chamar o reembolso

---

### Detalhes Tecnicos

**API do Asaas para reembolso:**
```
POST https://api.asaas.com/v3/payments/{id}/refund
Headers: { access_token: ASAAS_API_KEY }
```

**Dados necessarios por transacao:**
- `transaction_id`: para identificar o pagamento no Asaas (ex: `pay_abc123`)
- `user_id`: para fazer o downgrade no perfil
- `customer_email`: para exibir no dialogo de confirmacao
- `amount_paid`: para mostrar o valor a ser reembolsado

**Seguranca:**
- Edge Function valida JWT e verifica role `admin` no banco
- Usa `ASAAS_API_KEY` (ja configurada como secret)
- Transacoes Ticto nao tem API de reembolso automatico, entao so faz o downgrade e avisa o admin para estornar manualmente no painel da Ticto

