-- Remover a versão antiga da função que causa conflito
DROP FUNCTION IF EXISTS public.claim_next_job(integer, integer);