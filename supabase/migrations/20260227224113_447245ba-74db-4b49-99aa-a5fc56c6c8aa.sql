-- 1. Criar função que bloqueia alterações em campos sensíveis
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'Cannot modify tier';
  END IF;
  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    RAISE EXCEPTION 'Cannot modify credits';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot modify subscription_status';
  END IF;
  IF NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle THEN
    RAISE EXCEPTION 'Cannot modify billing_cycle';
  END IF;
  IF NEW.max_projects IS DISTINCT FROM OLD.max_projects THEN
    RAISE EXCEPTION 'Cannot modify max_projects';
  END IF;
  IF NEW.asaas_subscription_id IS DISTINCT FROM OLD.asaas_subscription_id THEN
    RAISE EXCEPTION 'Cannot modify asaas_subscription_id';
  END IF;
  IF NEW.total_generations IS DISTINCT FROM OLD.total_generations THEN
    RAISE EXCEPTION 'Cannot modify total_generations';
  END IF;
  IF NEW.trial_credits_given IS DISTINCT FROM OLD.trial_credits_given THEN
    RAISE EXCEPTION 'Cannot modify trial_credits_given';
  END IF;
  IF NEW.trial_start_date IS DISTINCT FROM OLD.trial_start_date THEN
    RAISE EXCEPTION 'Cannot modify trial_start_date';
  END IF;
  IF NEW.user_level IS DISTINCT FROM OLD.user_level THEN
    RAISE EXCEPTION 'Cannot modify user_level';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Cannot modify email';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Criar o trigger
CREATE TRIGGER protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();