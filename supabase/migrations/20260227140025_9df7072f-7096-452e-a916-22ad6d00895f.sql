-- Clean up stuck job
UPDATE jobs 
SET status = 'failed', finished_at = now(), error = 'Timeout - stuck in processing'
WHERE id = '35715632-380f-44bd-85ce-21092a46ebb8' AND status = 'processing';

-- Also clean any other jobs stuck in processing for more than 3 minutes
UPDATE jobs 
SET status = 'failed', finished_at = now(), error = 'Timeout - stuck in processing'
WHERE status = 'processing' AND started_at < now() - interval '3 minutes';