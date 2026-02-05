-- =============================================
-- FASE 1: SETUP COMPLETO DO BANCO DE DADOS
-- =============================================

-- 1. ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.reference_category AS ENUM ('photography', 'creative', 'food', 'product', 'portrait', 'landscape', 'abstract');

-- 2. TABELA PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 5,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. TABELA USER_ROLES (separada para segurança)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 4. TABELA PROJECTS
-- =============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  canvas_state JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. TABELA GENERATIONS
-- =============================================
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  image_url TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABELA REFERENCE_IMAGES
-- =============================================
CREATE TABLE public.reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category public.reference_category NOT NULL,
  image_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. TABELA PROJECT_TEMPLATES
-- =============================================
CREATE TABLE public.project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  canvas_state JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  thumbnail_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. TABELA CREDIT_PACKAGES
-- =============================================
CREATE TABLE public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_brl DECIMAL(10, 2) NOT NULL,
  product_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. TABELA WEBHOOK_LOGS
-- =============================================
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FUNÇÕES AUXILIARES
-- =============================================

-- Função para verificar role (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para criar profile no signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES: usuários acessam apenas próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- USER_ROLES: apenas admins podem gerenciar
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PROJECTS: usuários acessam apenas próprios projetos
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- GENERATIONS: usuários acessam apenas próprias gerações
CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generations"
  ON public.generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON public.generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- REFERENCE_IMAGES: leitura pública, escrita apenas admins
CREATE POLICY "Anyone can view reference images"
  ON public.reference_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage reference images"
  ON public.reference_images FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PROJECT_TEMPLATES: leitura pública, escrita apenas admins
CREATE POLICY "Anyone can view templates"
  ON public.project_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON public.project_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CREDIT_PACKAGES: leitura pública, escrita apenas admins
CREATE POLICY "Anyone can view credit packages"
  ON public.credit_packages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage credit packages"
  ON public.credit_packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- WEBHOOK_LOGS: apenas admins
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Bucket para imagens de referência (público)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reference-images', 'reference-images', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para mídia do usuário (público por URL)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-media', 'user-media', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para gerações (público por URL)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para reference-images
CREATE POLICY "Public read access for reference images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reference-images');

CREATE POLICY "Admins can upload reference images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reference-images' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies para user-media
CREATE POLICY "Users can view own media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-media');

CREATE POLICY "Users can upload own media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'user-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'user-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies para generations
CREATE POLICY "Users can view own generations files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generations');

CREATE POLICY "Users can upload generations"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_project_id ON public.generations(project_id);
CREATE INDEX idx_generations_status ON public.generations(status);
CREATE INDEX idx_reference_images_category ON public.reference_images(category);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);