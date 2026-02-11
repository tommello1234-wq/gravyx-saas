CREATE POLICY "users_can_view_own_jobs" ON public.jobs
FOR SELECT USING (auth.uid() = user_id);