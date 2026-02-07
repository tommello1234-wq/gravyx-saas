CREATE OR REPLACE FUNCTION public.claim_next_job(p_worker_id uuid DEFAULT gen_random_uuid())
 RETURNS TABLE(
   id uuid, 
   user_id uuid, 
   project_id uuid, 
   status text, 
   payload jsonb, 
   error text, 
   retries integer, 
   max_retries integer, 
   request_id text, 
   created_at timestamp with time zone, 
   started_at timestamp with time zone, 
   finished_at timestamp with time zone, 
   next_run_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_job_id uuid;
BEGIN
  -- Seleciona o próximo job e faz lock para evitar concorrência
  SELECT jobs.id INTO v_job_id
  FROM public.jobs
  WHERE jobs.status = 'queued'
    AND (jobs.next_run_at IS NULL OR jobs.next_run_at <= now())
  ORDER BY jobs.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN; -- retorna vazio
  END IF;

  -- Atualiza o job para processing
  UPDATE public.jobs
  SET 
    status = 'processing', 
    started_at = now(), 
    error = NULL, 
    request_id = COALESCE(jobs.request_id, p_worker_id::text)
  WHERE jobs.id = v_job_id;

  -- Retorna o job atualizado
  RETURN QUERY
  SELECT 
    jobs.id,
    jobs.user_id,
    jobs.project_id,
    jobs.status,
    jobs.payload,
    jobs.error,
    jobs.retries,
    jobs.max_retries,
    jobs.request_id,
    jobs.created_at,
    jobs.started_at,
    jobs.finished_at,
    jobs.next_run_at
  FROM public.jobs
  WHERE jobs.id = v_job_id;
END;
$function$;