

## Plano: Simplificar drasticamente o prompt do sistema

### Problema
O `systemText` atual envia um bloco enorme de instruções (análise de conteúdo visual, mapeamento de roles, exemplos, labels, etc.) antes do prompt do usuário. Isso provavelmente está confundindo o Gemini 3.1 e diluindo a intenção real. Quando o modelo recebia apenas "imagem + prompt direto", funcionava perfeitamente.

### Alteração

**`supabase/functions/image-worker/index.ts`** — simplificar o `systemText` na função `generateSingleImage`:

- Remover todo o bloco verboso de instruções sobre análise de conteúdo visual, roles, exemplos
- Enviar apenas o prompt do usuário como texto principal
- Se houver `libraryPrompt` em alguma referência, adicionar como hint curto (1 linha)
- Manter a numeração explícita apenas se o usuário usar no prompt
- Estrutura final dos `parts`: `[{ text: prompt }, imagem1, imagem2, ...]` — simples e direto, como se o usuário estivesse conversando no chat do Gemini

### Deploy
- Deploy do `image-worker`

### Resultado
O modelo recebe a imagem + prompt limpo, sem instruções confusas. Comportamento idêntico a usar o Gemini direto no chat.

