-- Create reference_categories table for dynamic category management
CREATE TABLE public.reference_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reference_categories ENABLE ROW LEVEL SECURITY;

-- Admin can manage categories
CREATE POLICY "reference_categories_admin_all" 
ON public.reference_categories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Everyone can view categories
CREATE POLICY "reference_categories_public_select" 
ON public.reference_categories 
FOR SELECT 
USING (true);

-- Migrate existing categories from enum
INSERT INTO public.reference_categories (slug, label) VALUES
  ('photography', 'Fotografia'),
  ('creative', 'Criativo'),
  ('food', 'Comida'),
  ('product', 'Produto'),
  ('portrait', 'Retrato'),
  ('landscape', 'Paisagem'),
  ('abstract', 'Abstrato');

-- Change reference_images.category column from enum to text
ALTER TABLE public.reference_images 
  ALTER COLUMN category TYPE text USING category::text;

-- Add profile fields for user customization
ALTER TABLE public.profiles 
  ADD COLUMN display_name text,
  ADD COLUMN avatar_url text;