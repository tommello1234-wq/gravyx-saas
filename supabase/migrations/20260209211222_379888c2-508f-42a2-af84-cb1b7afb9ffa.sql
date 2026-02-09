
CREATE OR REPLACE FUNCTION public.decrement_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_credits integer;
BEGIN
  -- CRITICAL: Verify caller owns the profile
  IF auth.uid() IS NULL OR auth.uid() != uid THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other users credits';
  END IF;
  
  -- Validate amount is positive
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be positive';
  END IF;
  
  UPDATE profiles
  SET credits = credits - amount
  WHERE user_id = uid
  RETURNING credits INTO new_credits;
  
  -- Check if credits went negative
  IF new_credits < 0 THEN
    -- Rollback by re-adding
    UPDATE profiles
    SET credits = credits + amount
    WHERE user_id = uid;
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  RETURN new_credits;
END;
$$;
