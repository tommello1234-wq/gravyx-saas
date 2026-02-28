
-- Fail all jobs stuck in 'processing' for more than 5 minutes
-- This is a one-time cleanup to clear the current stuck state
UPDATE public.jobs
SET 
  status = 'failed',
  finished_at = now(),
  error = 'Job stuck in processing (memory limit exceeded). Please try again with smaller reference images or fewer references.'
WHERE status = 'processing'
  AND started_at < now() - interval '5 minutes';
