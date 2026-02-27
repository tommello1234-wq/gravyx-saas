

## Diagnóstico: 3 Bugs na Chamada da API do Gemini

Comparando o código do `image-worker` com a documentação oficial da API REST do Gemini 3.1, encontrei **3 problemas** que explicam tanto o texto duplicado quanto o formato errado:

### Bug 1: Aspect ratio enviado como TEXTO no prompt, não via API

**Código atual (image-worker, linha 360-362):**
```javascript
let fullPrompt = prompt;
if (aspectRatio) {
  fullPrompt = `${prompt}. Aspect ratio: ${aspectRatio}`;
}
```

O aspect ratio está sendo concatenado como texto no prompt (ex: `"Troque o cara... Aspect ratio: 16:9"`). Isso **não é como a API funciona**. A documentação oficial mostra que o parâmetro correto é `generationConfig.imageConfig.aspectRatio`:

```json
"generationConfig": {
  "imageConfig": {
    "aspectRatio": "16:9"
  }
}
```

Colocar "Aspect ratio: 16:9" no texto do prompt confunde o modelo, causando formato errado e até interferindo na interpretação do prompt (texto duplicado).

### Bug 2: `imageSize: "1K"` não existe na API

**Código atual (image-worker, linha 199-202):**
```javascript
generationConfig: {
  responseModalities: ["TEXT", "IMAGE"],
  imageConfig: { imageSize: resolution }
}
```

O parâmetro `imageSize` com valores "1K", "2K", "4K" **não existe na documentação da API REST do Gemini 3.1**. Está sendo silenciosamente ignorado. O aspect ratio real não está sendo definido em lugar nenhum via API.

### Bug 3: Modo "Auto" faz detecção manual em vez de delegar ao modelo

**Código atual (Editor.tsx, linhas 692-735):** Quando o usuário seleciona "Auto", o frontend carrega a imagem de referência, calcula `naturalWidth/naturalHeight`, e mapeia para presets fixos (1:1, 4:5, 16:9, 9:16). No Google AI Studio, "Auto" simplesmente **não envia nenhum aspect ratio**, e o modelo decide sozinho pelo contexto. O Gemini 3.1 suporta 12 aspect ratios: 1:1, 3:2, 2:3, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9.

---

### Plano de Correção

#### 1. `supabase/functions/image-worker/index.ts`
- Remover a concatenação de aspect ratio no prompt (linhas 360-363)
- Passar `aspectRatio` como parâmetro da função `callGeminiAndUpload`
- No `generationConfig.imageConfig`, usar `aspectRatio` em vez de `imageSize`
- Quando aspectRatio for vazio/null (modo Auto), omitir `aspectRatio` do `imageConfig`

```javascript
// ANTES
fullPrompt = `${prompt}. Aspect ratio: ${aspectRatio}`;
// ...
imageConfig: { imageSize: resolution }

// DEPOIS
// Prompt fica limpo, sem aspect ratio
fullPrompt = prompt;
// ...
imageConfig: aspectRatio ? { aspectRatio } : {}
```

#### 2. `supabase/functions/generate-image/index.ts`
- Expandir `validAspectRatios` para incluir todos os formatos suportados pelo Gemini 3.1
- Permitir aspectRatio vazio/null (para modo Auto)
- Remover o `imageSize` do `resolution` mapping, já que não é um parâmetro válido da API

#### 3. `src/pages/Editor.tsx`
- No `generateForResult`, quando `aspectRatio === 'auto'`, enviar string vazia (ou não enviar) em vez de tentar detectar
- Remover toda a lógica de detecção manual de aspect ratio (linhas 692-735)

### Arquivos impactados
| Arquivo | Alteração |
|---|---|
| `supabase/functions/image-worker/index.ts` | Corrigir `imageConfig` para usar `aspectRatio` via API, remover texto no prompt |
| `supabase/functions/generate-image/index.ts` | Expandir aspect ratios válidos, permitir Auto (vazio) |
| `src/pages/Editor.tsx` | Simplificar modo Auto: enviar vazio em vez de detectar |

### Resultado esperado
Após as correções, o comportamento será idêntico ao Google AI Studio: o aspect ratio é controlado pela API (não por texto no prompt), e no modo Auto o modelo decide sozinho pelo contexto das imagens de referência.

