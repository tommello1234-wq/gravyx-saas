-- Passo 1: Limpa Base64 e images de TODOS os projetos
UPDATE projects
SET canvas_state = (
  SELECT jsonb_build_object(
    'nodes', (
      SELECT jsonb_agg(
        CASE 
          -- Output nodes: remove images array
          WHEN node->>'type' = 'output' THEN 
            jsonb_set(node, '{data}', (node->'data') - 'images')
          -- Media nodes: remove base64 URLs
          WHEN node->>'type' = 'media' 
               AND node->'data'->>'url' LIKE 'data:image%' THEN
            jsonb_set(node, '{data,url}', 'null'::jsonb)
          ELSE node
        END
      )
      FROM jsonb_array_elements(canvas_state->'nodes') AS node
    ),
    'edges', canvas_state->'edges'
  )
)
WHERE canvas_state::text LIKE '%data:image%'
   OR canvas_state::text LIKE '%"images":%';

-- Passo 2: Limpa Base64 e images de TODOS os templates
UPDATE project_templates
SET canvas_state = (
  SELECT jsonb_build_object(
    'nodes', (
      SELECT jsonb_agg(
        CASE 
          WHEN node->>'type' = 'output' THEN 
            jsonb_set(node, '{data}', (node->'data') - 'images')
          WHEN node->>'type' = 'media' 
               AND node->'data'->>'url' LIKE 'data:image%' THEN
            jsonb_set(node, '{data,url}', 'null'::jsonb)
          ELSE node
        END
      )
      FROM jsonb_array_elements(canvas_state->'nodes') AS node
    ),
    'edges', canvas_state->'edges'
  )
)
WHERE canvas_state::text LIKE '%data:image%'
   OR canvas_state::text LIKE '%"images":%';