
CREATE POLICY "generations_admin_select" ON generations
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "jobs_admin_select" ON jobs
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
