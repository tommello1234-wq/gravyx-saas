-- Bloquear acesso anônimo à tabela webhook_logs
CREATE POLICY "Block anonymous access to webhook_logs"
ON public.webhook_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Restringir acesso a webhook_logs apenas para admins
CREATE POLICY "Only admins can access webhook_logs"
ON public.webhook_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));