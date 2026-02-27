

## Plano: Simplificar instrução do sistema para Gemini interpretar imagens por conteúdo

### Problema
A instrução atual no `image-worker` enfatiza numeração ("Image 1", "Image 2"), mas o usuário não sabe qual número cada imagem recebeu. O Gemini deveria inferir o papel de cada imagem pelo conteúdo visual + contexto do prompt.

### Alterações

1. **`supabase/functions/image-worker/index.ts`** — reescrever o `systemText` na função `generateSingleImage`:
   - Remover ênfase em numeração
   - Instruir o Gemini a **analisar o conteúdo visual** de cada imagem e deduzir o papel (rosto, cena, estilo, etc.) baseado no prompt do usuário
   - Manter numeração apenas como fallback caso o usuário mencione explicitamente "imagem 1" no prompt
   - Instrução mais clara: "Analyze the visual content of each reference image. Match each image to the relevant part of the user's prompt based on what you see (e.g., a face photo should be used as the identity/face, a landscape should be used as the scene/background)."

2. **Deploy** do `image-worker`

### Resultado
O usuário simplesmente conecta as imagens e escreve o prompt descrevendo o que quer. O Gemini analisa visualmente cada imagem e decide como usá-la.
