-- Fix 1: Profiles - Block unauthenticated access to emails
-- The existing policies only work for authenticated users, but we need to explicitly deny anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Fix 2: Webhook logs - Add UPDATE/DELETE policies for admins
CREATE POLICY "Admins can update webhook logs"
ON public.webhook_logs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete webhook logs"
ON public.webhook_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Webhook logs - Explicitly deny non-admin SELECT (already has admin-only policy, but add explicit deny for extra safety)
-- The existing policy "Admins can view webhook logs" uses has_role check
-- We add a deny policy for authenticated non-admins
CREATE POLICY "Block non-admin access to webhook logs"
ON public.webhook_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));