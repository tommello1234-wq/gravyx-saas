
# Plano: Integração Webhook Ticto para Créditos Automáticos

## Resumo

Implementar um sistema completo de webhook para receber notificações de pagamento da Ticto e adicionar créditos automaticamente quando uma compra for aprovada ("Venda Realizada").

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE COMPRA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Usuário clica        2. Ticto processa      3. Webhook envia       │
│     em "Comprar"            pagamento              notificação         │
│                                                                         │
│   ┌─────────┐           ┌──────────────┐       ┌─────────────────┐     │
│   │ App Web │ ────────> │ Ticto        │ ────> │ Edge Function   │     │
│   │         │           │ payment.ticto│       │ ticto-webhook   │     │
│   └─────────┘           └──────────────┘       └────────┬────────┘     │
│                                                         │              │
│                         4. Adiciona créditos            │              │
│                                                         v              │
│                                                 ┌───────────────┐      │
│                                                 │   Supabase    │      │
│                                                 │  - profiles   │      │
│                                                 │  - purchases  │      │
│                                                 └───────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## O que será criado

| Tipo | Nome | Descrição |
|------|------|-----------|
| Edge Function | `ticto-webhook` | Recebe webhooks da Ticto e processa pagamentos |
| Tabela DB | `credit_purchases` | Registra todas as compras de créditos |
| Alteração | `BuyCreditsModal.tsx` | Adicionar email do usuário na URL de compra |

---

## Detalhes Técnicos

### 1. Edge Function: ticto-webhook

**Endpoint:** `POST /functions/v1/ticto-webhook`

**Responsabilidades:**
- Receber payload do webhook da Ticto
- Validar o evento ("Venda Realizada" / "APPROVED")
- Identificar o usuário pelo email
- Mapear o produto para quantidade de créditos
- Adicionar créditos ao perfil do usuário
- Registrar a transação em `credit_purchases`
- Prevenir duplicatas usando transaction_id

**Payload esperado da Ticto (baseado em webhooks similares):**

```json
{
  "event": "APPROVED",
  "transaction": {
    "id": "TXN123456",
    "status": "approved",
    "amount": 2990,
    "currency": "BRL"
  },
  "customer": {
    "email": "usuario@email.com",
    "name": "Nome do Usuário",
    "document": "12345678900"
  },
  "product": {
    "id": "O7EB601F4",
    "name": "Starter - 50 Créditos"
  }
}
```

**Mapeamento de produtos:**

```typescript
const PRODUCT_CREDITS: Record<string, number> = {
  'O7EB601F4': 50,   // Starter
  'O37CE7121': 120,  // Pro
  'OD5F04218': 400,  // Business
};
```

**Lógica principal:**

```typescript
// 1. Validar evento
if (body.event !== 'APPROVED' && body.event !== 'Venda Realizada') {
  return new Response('Event ignored', { status: 200 });
}

// 2. Verificar duplicata
const { data: existingPurchase } = await supabase
  .from('credit_purchases')
  .select('id')
  .eq('transaction_id', body.transaction.id)
  .maybeSingle();

if (existingPurchase) {
  return new Response('Already processed', { status: 200 });
}

// 3. Buscar usuário por email
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('email', body.customer.email)
  .single();

// 4. Calcular créditos
const credits = PRODUCT_CREDITS[body.product.id] || 0;

// 5. Adicionar créditos
await supabase
  .from('profiles')
  .update({ credits: profile.credits + credits })
  .eq('user_id', profile.user_id);

// 6. Registrar compra
await supabase
  .from('credit_purchases')
  .insert({
    user_id: profile.user_id,
    transaction_id: body.transaction.id,
    product_id: body.product.id,
    credits_added: credits,
    amount_paid: body.transaction.amount,
    customer_email: body.customer.email,
    raw_payload: body
  });
```

### 2. Nova Tabela: credit_purchases

**Estrutura:**

```sql
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  transaction_id TEXT UNIQUE NOT NULL,
  product_id TEXT NOT NULL,
  credits_added INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  customer_email TEXT NOT NULL,
  raw_payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todas as compras
CREATE POLICY "Admins can view all purchases"
  ON credit_purchases FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Usuários podem ver próprias compras
CREATE POLICY "Users can view own purchases"
  ON credit_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Insert via service role only (webhook)
CREATE POLICY "Service role can insert"
  ON credit_purchases FOR INSERT
  WITH CHECK (true);
```

### 3. Modificação: BuyCreditsModal.tsx

Passar o email do usuário como parâmetro na URL para identificação:

```typescript
const handleBuy = (url: string) => {
  const urlWithEmail = profile?.email 
    ? `${url}?email=${encodeURIComponent(profile.email)}`
    : url;
  window.open(urlWithEmail, '_blank');
};
```

---

## Configuração na Ticto

Após implementar, você precisa configurar o webhook no painel da Ticto:

1. Acesse **TICTOOLS > WEBHOOK**
2. Clique em **+ADICIONAR**
3. Configure:
   - **Produto**: Selecione cada pacote de créditos
   - **URL**: `https://oruslrvpmdhtnrsgoght.supabase.co/functions/v1/ticto-webhook`
   - **Evento**: Venda Realizada
4. Repita para cada produto (Starter, Pro, Business)

---

## Tratamento de Erros

A edge function tratará os seguintes cenários:

| Cenário | Ação |
|---------|------|
| Email não encontrado | Log em webhook_logs, retorna 200 |
| Produto desconhecido | Log com produto_id, retorna 200 |
| Duplicata (mesmo transaction_id) | Ignora, retorna 200 |
| Erro no banco | Retorna 500 com mensagem |

**Importante:** Sempre retornar 200 para eventos válidos, mesmo que não processados, para evitar reenvios infinitos da Ticto.

---

## Logging e Debug

Todas as requisições serão logadas em `webhook_logs`:

```typescript
await supabase.from('webhook_logs').insert({
  event_type: body.event || 'unknown',
  payload: body,
  processed: true/false,
  error_message: error?.message
});
```

Isso permite debug no painel Admin (já existe a tabela).

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/ticto-webhook/index.ts` | Criar - Edge function do webhook |
| `supabase/config.toml` | Modificar - Adicionar config da função |
| `src/components/BuyCreditsModal.tsx` | Modificar - Passar email na URL |
| Migration SQL | Criar - Tabela credit_purchases |

---

## Testes

Após implementação:

1. Fazer uma compra de teste na Ticto
2. Verificar logs em `webhook_logs`
3. Confirmar créditos adicionados no perfil
4. Verificar registro em `credit_purchases`
