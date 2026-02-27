

## Plano: Aumentar limite de imagens de referência para 10

### Alterações

1. **`supabase/functions/image-worker/index.ts`** (linha 321):
   - Mudar `.slice(0, 3)` para `.slice(0, 10)`
   - Atualizar comentário na linha 314

2. **Deploy automático** do `image-worker`

Isso permite que até 10 nós de Mídia conectados ao Resultado enviem suas imagens como referência ao Gemini.

