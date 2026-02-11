CREATE OR REPLACE FUNCTION public.increment_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_credits integer;
BEGIN
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