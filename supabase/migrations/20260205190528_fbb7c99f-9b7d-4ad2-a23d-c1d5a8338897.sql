-- Remover política antiga (só admins)
DROP POLICY IF EXISTS "Admins can upload reference images" ON storage.objects;

-- Criar nova política para usuários autenticados
CREATE POLICY "Users can upload reference images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reference-images' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Adicionar política de DELETE para usuários poderem remover suas imagens
CREATE POLICY "Users can delete own reference images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reference-images' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);