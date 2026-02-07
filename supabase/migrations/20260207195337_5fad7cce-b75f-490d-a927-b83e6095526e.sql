-- PROFILES
DROP POLICY IF EXISTS "profiles_admin_view" ON profiles;
CREATE POLICY "profiles_admin_view" ON profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- USER_ROLES
DROP POLICY IF EXISTS "user_roles_admin_manage" ON user_roles;
CREATE POLICY "user_roles_admin_manage" ON user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- WEBHOOK_LOGS
DROP POLICY IF EXISTS "webhook_logs_admin_select" ON webhook_logs;
CREATE POLICY "webhook_logs_admin_select" ON webhook_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "webhook_logs_admin_update" ON webhook_logs;
CREATE POLICY "webhook_logs_admin_update" ON webhook_logs
  FOR UPDATE USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "webhook_logs_admin_delete" ON webhook_logs;
CREATE POLICY "webhook_logs_admin_delete" ON webhook_logs
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- REFERENCE_IMAGES
DROP POLICY IF EXISTS "reference_images_admin_all" ON reference_images;
CREATE POLICY "reference_images_admin_all" ON reference_images
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- PROJECT_TEMPLATES
DROP POLICY IF EXISTS "project_templates_admin_all" ON project_templates;
CREATE POLICY "project_templates_admin_all" ON project_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- CREDIT_PACKAGES
DROP POLICY IF EXISTS "credit_packages_admin_all" ON credit_packages;
CREATE POLICY "credit_packages_admin_all" ON credit_packages
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- CREDIT_PURCHASES
DROP POLICY IF EXISTS "credit_purchases_admin_select" ON credit_purchases;
CREATE POLICY "credit_purchases_admin_select" ON credit_purchases
  FOR SELECT USING (has_role(auth.uid(), 'admin'));