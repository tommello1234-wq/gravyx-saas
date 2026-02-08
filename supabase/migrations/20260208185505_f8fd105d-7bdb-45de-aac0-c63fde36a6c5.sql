-- Adiciona campo para rastrear qual node gerou a imagem
ALTER TABLE generations ADD COLUMN IF NOT EXISTS result_node_id TEXT;

-- Índice para consultas eficientes por node
CREATE INDEX IF NOT EXISTS idx_generations_result_node_id 
  ON generations(result_node_id) WHERE result_node_id IS NOT NULL;