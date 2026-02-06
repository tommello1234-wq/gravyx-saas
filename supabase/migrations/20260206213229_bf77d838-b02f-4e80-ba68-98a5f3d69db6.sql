-- Create decrement_credits function for atomic credit deduction
CREATE OR REPLACE FUNCTION public.decrement_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits integer;
BEGIN
  UPDATE profiles
  SET credits = credits - amount
  WHERE user_id = uid
  RETURNING credits INTO new_credits;
  
  RETURN new_credits;
END;
$$;