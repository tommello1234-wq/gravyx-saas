
# Plano: Corrigir Políticas RLS de Admin

## Problema Identificado

As políticas RLS para admin estão usando:
```sql
(auth.jwt() ->> 'user_role') = 'admin'
```

Mas o **JWT do Supabase não contém essa claim por padrão**. Por isso, mesmo sendo admin na tabela `user_roles`, o banco de dados não reconhece sua permissão.

### Evidência
- Tabela `user_roles`: você (tommello1234@gmail.com) tem role = 'admin'
- Tabela `profiles`: tem 15 usuários cadastrados
- Painel Admin: só mostra 1 usuário (você mesmo)

## Solução

Alterar TODAS as políticas RLS que usam `auth.jwt() ->> 'user_role'` para usar a função `has_role()` que já existe no banco:

```sql
-- DE (não funciona):
(auth.jwt() ->> 'user_role') = 'admin'

-- PARA (funciona):
has_role(auth.uid(), 'admin')
```

## Tabelas Afetadas

| Tabela | Políticas a Corrigir |
|--------|---------------------|
| profiles | profiles_admin_view, profiles_admin_update |
| user_roles | user_roles_admin_manage |
| webhook_logs | webhook_logs_admin_select, webhook_logs_admin_update, webhook_logs_admin_delete |
| reference_images | reference_images_admin_all |
| project_templates | project_templates_admin_all |
| credit_packages | credit_packages_admin_all |
| credit_purchases | credit_purchases_admin_select |

## Migration SQL

```sql
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
```

## Resultado Esperado

Após a migration:
- O painel Admin mostrará todos os 15 usuários
- Você poderá editar créditos, reenviar convites e deletar usuários
- Todas as funcionalidades de admin voltarão a funcionar

## Arquivos

| Ação | Descrição |
|------|-----------|
| Nova migration SQL | Corrige todas as políticas RLS de admin |
