CREATE OR REPLACE FUNCTION public.decrement_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_credits integer;
BEGIN
  -- Allow service_role (auth.uid() is NULL) but block users modifying others
  IF auth.uid() IS NOT NULL AND auth.uid() != uid THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other users credits';
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