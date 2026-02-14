
-- Fix decrement_credits: restrict to service_role only (matching increment_credits pattern)
CREATE OR REPLACE FUNCTION public.decrement_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  UPDATE profiles
  SET credits = credits - amount
  WHERE user_id = uid
  RETURNING credits INTO new_credits;
  
  IF new_credits < 0 THEN
    UPDATE profiles
    SET credits = credits + amount
    WHERE user_id = uid;
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  RETURN new_credits;
END;
$$;

-- Revoke direct access from authenticated users
REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid, integer) FROM anon;
