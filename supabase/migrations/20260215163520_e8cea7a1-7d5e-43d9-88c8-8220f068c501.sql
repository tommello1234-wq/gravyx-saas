
-- 1. Create the many-to-many join table
CREATE TABLE public.reference_image_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.reference_images(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.reference_categories(id) ON DELETE CASCADE,
  UNIQUE(image_id, category_id)
);

-- 2. Enable RLS
ALTER TABLE public.reference_image_tags ENABLE ROW LEVEL SECURITY;

-- 3. RLS: everyone can read
CREATE POLICY "reference_image_tags_public_select"
  ON public.reference_image_tags
  FOR SELECT
  USING (true);

-- 4. RLS: only admins can write
CREATE POLICY "reference_image_tags_admin_all"
  ON public.reference_image_tags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Migrate existing data: map each image's category text to the matching reference_categories row
INSERT INTO public.reference_image_tags (image_id, category_id)
SELECT ri.id, rc.id
FROM public.reference_images ri
JOIN public.reference_categories rc ON rc.slug = ri.category
ON CONFLICT DO NOTHING;

-- 6. Insert "Grátis" category if it doesn't exist
INSERT INTO public.reference_categories (slug, label)
VALUES ('free', 'Grátis')
ON CONFLICT DO NOTHING;
