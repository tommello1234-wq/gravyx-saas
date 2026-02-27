

## Plano: Adicionar seletor de resolução (1K, 2K, 4K) no nó de Resultado

### Como funciona na API
O Gemini 3.1 Flash aceita `generationConfig.imageConfig.imageSize` com valores `"512px"`, `"1K"`, `"2K"`, `"4K"`. Basta adicionar esse campo no body da chamada ao endpoint REST.

### Alterações

**1. `src/components/nodes/ResultNode.tsx`**
- Adicionar `resolution` ao `ResultNodeData` (default `"1K"`)
- Criar array de opções: `[{ value: "1K", label: "1K" }, { value: "2K", label: "2K" }, { value: "4K", label: "4K" }]`
- Adicionar um novo Popover/dropdown compacto ao lado do seletor de formato, com o mesmo estilo visual (bg-zinc-900, border-zinc-800, etc.)
- Persistir `resolution` no node data via `updateNodeData`

**2. `src/pages/Editor.tsx`**
- Na função `generateForResult`, ler `resolution` do node data do ResultNode
- Enviar `resolution` no body da chamada a `generate-image`

**3. `supabase/functions/generate-image/index.ts`**
- Aceitar `resolution` do request body
- Validar valores permitidos: `["1K", "2K", "4K"]`
- Persistir `resolution` no `jobs.payload`

**4. `supabase/functions/image-worker/index.ts`**
- Ler `payload.resolution` (default `"1K"`)
- Adicionar `imageConfig: { imageSize: resolution }` dentro do `generationConfig` na chamada ao endpoint REST do Google

**5. Deploy** de `generate-image` e `image-worker`

### Resultado
O usuário verá um dropdown "1K" ao lado do seletor de formato. Ao clicar, pode escolher 2K ou 4K para gerar imagens em alta resolução.

