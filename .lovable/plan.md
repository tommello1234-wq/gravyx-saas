

## Diagnóstico: Como está a montagem do prompt hoje

No `image-worker/index.ts`, o payload enviado ao Gemini atualmente inclui:

1. **Texto do prompt** do usuário
2. **Sufixo `Style reference: ...`** — concatena `libraryPrompt` de imagens vindas da biblioteca
3. **Marcadores `[Image: Nome do Nó]`** — um texto antes de cada imagem identificando o nó de origem
4. **Imagens via Gemini Files API** — upload correto, sem base64

No frontend (`Editor.tsx`), cada referência carrega `label`, `libraryPrompt`, `source` e `index`.

## O que simplificar

A IA do Gemini entende contexto visual nativamente. A relação deve ser: **prompt + imagens, nada mais** — como no chat do Gemini.

### Alterações no `image-worker/index.ts`

- **Remover** o bloco que adiciona `Style reference: ...` (linhas 208-215)
- **Remover** o bloco que insere `[Image: Label]` antes de cada imagem (linhas 222-224)
- Resultado: `parts` = `[{ text: prompt }, { file_data: img1 }, { file_data: img2 }, ...]`

### Alterações no `Editor.tsx`

- **Simplificar** a interface `ImageReference` — remover `label`, `libraryPrompt`, `source`; manter apenas `url` e `index`
- **Simplificar** `collectGravityContext` e `collectLocalContext` — retornar apenas URLs, sem metadados extras
- O payload enviado ao `generate-image` continua com `references` (lista de `{url, index}`) para deduplicação, mas sem metadados de estilo

### Nenhuma alteração no `image-worker` em relação a `ReferenceInfo`

- Simplificar a interface `ReferenceInfo` para apenas `{ url: string; index: number }`
- O worker ignora `label` e `libraryPrompt` que deixam de ser enviados

### Arquivos impactados
- `supabase/functions/image-worker/index.ts`
- `src/pages/Editor.tsx`

### Resultado
Prompt + imagens, sem anotações. Simples como no chat do Gemini.

