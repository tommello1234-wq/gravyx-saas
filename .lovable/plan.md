

## Atualizar modelo de geração para `gemini-3.1-flash-image-preview`

### Contexto
O worker não usa SDK do Google — faz chamadas REST diretas para `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`. Portanto, não há problema de SDK desatualizado. Basta trocar o nome do modelo na constante.

### Implementação

1. **Alterar constante `IMAGE_MODEL` em `supabase/functions/image-worker/index.ts`**:
   - De: `"gemini-3-pro-image-preview"`
   - Para: `"gemini-3.1-flash-image-preview"`

2. **Atualizar texto do banner de manutenção em `src/pages/Editor.tsx`** para refletir o novo nome do modelo (Nano Banana 2 → referência ao novo modelo)

3. **Deploy do image-worker** para aplicar a mudança

### Observação técnica
Como usamos a API REST direta do Google (`generativelanguage.googleapis.com/v1beta`), não há dependência de SDK. O endpoint aceita qualquer modelo disponível na API — basta que o nome esteja correto e o modelo esteja habilitado na chave de API.

