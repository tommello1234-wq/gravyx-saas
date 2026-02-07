-- Tabela para registrar compras de créditos
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todas as compras
CREATE POLICY "Admins can view all purchases"
  ON public.credit_purchases FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem ver próprias compras
CREATE POLICY "Users can view own purchases"
  ON public.credit_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Índice para busca por transaction_id (evitar duplicatas)
CREATE INDEX idx_credit_purchases_transaction_id ON public.credit_purchases(transaction_id);

-- Índice para busca por user_id
CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases(user_id);