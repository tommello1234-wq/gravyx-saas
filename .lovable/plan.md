

## Correção: Usar Flash para todas as resoluções (1K/2K/4K)

O `gemini-3.1-flash-image-preview` suporta nativamente `imageSize: "2K"` e `imageSize: "4K"` no `imageConfig`. Não precisa trocar para o modelo Pro.

### Alteração

**`supabase/functions/image-worker/index.ts`**

1. Remover a constante `IMAGE_MODEL_PRO` e a função `getModelForResolution`
2. Voltar a usar `IMAGE_MODEL_FLASH` ("gemini-3.1-flash-image-preview") para **todas** as resoluções
3. Manter o `imageConfig.imageSize = resolution` para 2K/4K (isso já está correto)
4. Atualizar os logs para refletir que é sempre o modelo Flash
5. Redeploy da edge function

