-- Add billing_cycle column to profiles
ALTER TABLE public.profiles 
ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly';

-- Add check constraint via trigger for valid values
CREATE OR REPLACE FUNCTION public.validate_billing_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.billing_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Invalid billing_cycle: must be monthly or annual';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_billing_cycle_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_cycle();