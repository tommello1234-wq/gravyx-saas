-- Corrigir política permissiva em webhook_logs
-- Esta tabela só deve ser acessada pelo service_role via edge functions
DROP POLICY IF EXISTS "Service role can insert webhook logs" ON public.webhook_logs;

-- Negar INSERT para usuários autenticados normais (service_role bypass RLS)
CREATE POLICY "Deny direct insert to webhook logs"
  ON public.webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);