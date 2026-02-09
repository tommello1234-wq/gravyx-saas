
-- 1. Add DELETE policy for generations table (allows users to delete their own generations)
CREATE POLICY "generations_user_delete"
ON public.generations
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- 2. Add DELETE policy for generations storage bucket (allows users to delete their own files)
CREATE POLICY "Users can delete own generations"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generations'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
