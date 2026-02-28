

## Plano: Limpar pipeline de geração — caminho único e simples

### Problema atual
Três pontos de atrito restantes:

1. **`generate-image/index.ts`** (linha 192-198): Ainda mapeia `label` e `libraryPrompt` nos references do payload — campos que o frontend já não envia
2. **`generate-image/index.ts`** (linha 192): Ainda salva `imageUrls` no payload do job — duplicação desnecessária
3. **`image-worker/index.ts`** (linhas 193-194, 448-463, 471, 477): Ainda tem lógica de branching `useEnrichedRefs` e fallback para `imageUrls` — código morto que adiciona complexidade

### Alterações

**1. `supabase/functions/generate-image/index.ts`**
- Remover `imageUrls` do payload do job (linha 192)
- Simplificar mapeamento de references para `{ url, index }` apenas (linhas 193-198)
- Remover validação de `imageUrls` (linhas 119-129) — campo não mais utilizado

**2. `supabase/functions/image-worker/index.ts`**
- Remover `imageUrls` do tipo do payload e da destructuring (linhas 448, 454)
- Remover `useEnrichedRefs` e branching — usar sempre `references` (linhas 193-194)
- Remover `validImageUrls` processing (linhas 459-463, 471)
- Parâmetro `imageUrls` removido de `generateSingleImage` (linha 183)

**3. `src/pages/Editor.tsx`**
- Remover `imageUrls: allMedias` da chamada `invoke` (linha 734)
- Simplificar: enviar apenas `references` como fonte única de URLs

### Resultado
Caminho único: `references: [{url, index}]` → Gemini Files API → `[text, file_data, ...]` → imagem gerada.

