UPDATE jobs 
SET status = 'failed', finished_at = now(), error = 'Memory limit exceeded - auto cleanup'
WHERE status IN ('queued', 'processing') 
AND created_at < now() - interval '1 hour';