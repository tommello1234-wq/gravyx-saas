-- Bloquear acesso anônimo à tabela credit_purchases
CREATE POLICY "Block anonymous access to credit_purchases"
ON public.credit_purchases
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Bloquear INSERT anônimo na tabela profiles
CREATE POLICY "Block anonymous insert on profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (false);

-- Bloquear DELETE anônimo na tabela profiles
CREATE POLICY "Block anonymous delete on profiles"
ON public.profiles
FOR DELETE
TO anon
USING (false);

-- Bloquear UPDATE anônimo na tabela profiles (por segurança adicional)
CREATE POLICY "Block anonymous update on profiles"
ON public.profiles
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);