

## Plano: Resolução real (2K/4K) na geração de imagens

### Contexto
A API do Gemini suporta controle de resolução nativa via `outputImageWidth`/`outputImageHeight` no `imageConfig` do `generationConfig`. Atualmente o worker ignora o parâmetro `resolution` na chamada à API.

### Alterações

**1. `supabase/functions/image-worker/index.ts` - `callGeminiAndUpload`**
- Criar mapeamento de resolução para dimensões baseado no aspect ratio:
  - `1K`: não definir (padrão do modelo, ~1024px)
  - `2K`: lado maior = 2048
  - `4K`: lado maior = 4096
- Calcular `outputImageWidth` e `outputImageHeight` a partir do aspect ratio + resolução alvo
- Adicionar esses campos ao `imageConfig` junto com `aspectRatio`
- Para `4K`, usar modelo `gemini-2.0-flash-exp` ou `imagen-4-ultra` se `gemini-3.1-flash-image-preview` não suportar alta resolução (testar primeiro com o modelo atual)

**2. Lógica de cálculo de dimensões**
- Função helper `getOutputDimensions(aspectRatio, resolution)` que retorna `{ width, height }`
- Exemplos:
  - `16:9` + `4K` → `4096 x 2304`
  - `1:1` + `4K` → `4096 x 4096`
  - `9:16` + `2K` → `1152 x 2048`
  - Sem aspect ratio + `4K` → `4096 x 4096` (quadrado por padrão)

**3. Deploy**
- Redeployar `image-worker` com as dimensões sendo passadas ao Gemini

