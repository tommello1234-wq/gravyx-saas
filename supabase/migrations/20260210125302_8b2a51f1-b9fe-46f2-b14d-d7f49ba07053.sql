-- Fix storage SELECT policies to enforce owner-scoped access

-- Fix generations bucket SELECT policy
DROP POLICY IF EXISTS "Users can view own generations files" ON storage.objects;
CREATE POLICY "Users can view own generations files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generations' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Fix user-media bucket SELECT policy
DROP POLICY IF EXISTS "Users can view own media" ON storage.objects;
CREATE POLICY "Users can view own media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
