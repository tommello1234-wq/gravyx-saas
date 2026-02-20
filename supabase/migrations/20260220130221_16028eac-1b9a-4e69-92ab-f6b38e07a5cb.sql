
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS total_generations integer NOT NULL DEFAULT 0;

-- Backfill com dados atuais
UPDATE public.profiles p
SET total_generations = COALESCE(
  (SELECT COUNT(*) FROM public.generations g 
   WHERE g.user_id = p.user_id AND g.status = 'completed'), 0
);

-- Funcao para incrementar (service role only)
CREATE OR REPLACE FUNCTION public.increment_total_generations(uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Service role only';
  END IF;
  UPDATE public.profiles
  SET total_generations = total_generations + 1, updated_at = now()
  WHERE user_id = uid;
END;
$$;
