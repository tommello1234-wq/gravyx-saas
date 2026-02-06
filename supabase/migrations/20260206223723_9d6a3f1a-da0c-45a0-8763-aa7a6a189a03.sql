-- Adicionar coluna saved_to_gallery na tabela generations
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS saved_to_gallery boolean DEFAULT false;