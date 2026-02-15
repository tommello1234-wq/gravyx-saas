-- Revoke EXECUTE on sensitive SECURITY DEFINER functions from anon role
-- These should only be callable by service_role (from edge functions)
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_job(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_job_with_result(uuid, text[], integer) FROM anon;

-- Also revoke from authenticated role since these are service-role-only
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_next_job(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_job_with_result(uuid, text[], integer) FROM authenticated;