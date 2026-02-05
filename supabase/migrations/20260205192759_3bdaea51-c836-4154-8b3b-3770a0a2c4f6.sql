-- Inserir admin role para o usuário
INSERT INTO user_roles (user_id, role)
VALUES ('48f8cc37-92ab-402f-b9a7-8a4ea6f1a45a', 'admin')
ON CONFLICT DO NOTHING;

-- Permitir admins ver todos os profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Permitir admins atualizar todos os profiles
CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));