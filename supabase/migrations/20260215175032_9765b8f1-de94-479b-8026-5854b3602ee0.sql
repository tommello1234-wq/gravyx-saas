
-- 1. Create community_submissions table
CREATE TABLE public.community_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  image_url text NOT NULL,
  category_slug text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid
);

-- 2. Add submitted_by to reference_images
ALTER TABLE public.reference_images ADD COLUMN submitted_by uuid;

-- 3. Enable RLS on community_submissions
ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own submissions
CREATE POLICY "submissions_user_insert"
ON public.community_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own submissions
CREATE POLICY "submissions_user_select"
ON public.community_submissions FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all submissions
CREATE POLICY "submissions_admin_select"
ON public.community_submissions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all submissions
CREATE POLICY "submissions_admin_update"
ON public.community_submissions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Block anonymous access
CREATE POLICY "submissions_block_anon"
ON public.community_submissions FOR ALL
USING (false)
WITH CHECK (false);

-- 4. Storage policy for submissions uploads
CREATE POLICY "users_upload_submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reference-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'submissions'
);
