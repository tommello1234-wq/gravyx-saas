
-- Fix 1: Block direct INSERT/UPDATE/DELETE on jobs table (service_role bypasses RLS)
CREATE POLICY "Block direct job inserts" ON public.jobs FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct job updates" ON public.jobs FOR UPDATE USING (false);
CREATE POLICY "Block direct job deletes" ON public.jobs FOR DELETE USING (false);

-- Fix 2: Lock increment_credits to service_role only
CREATE OR REPLACE FUNCTION public.increment_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_credits integer;
BEGIN
  -- Only allow service role (auth.uid() is NULL for service role)
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Service role only';
  END IF;

  IF amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be positive';
  END IF;

  UPDATE public.profiles
  SET credits = credits + amount, updated_at = now()
  WHERE user_id = uid
  RETURNING credits INTO new_credits;

  RETURN new_credits;
END;
$$;
