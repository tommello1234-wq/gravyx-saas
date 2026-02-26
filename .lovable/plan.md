

## Plano: Suporte real a aspect ratios personalizados

### 1. `supabase/functions/generate-image/index.ts`
- Remover a validação restritiva que bloqueia ratios fora dos 4 presets
- Aceitar qualquer ratio no formato `N:N` (validar apenas que são dois números positivos)

### 2. `src/pages/Editor.tsx`
- Remover o bloco de mapeamento (linhas ~690-703) que converte ratios custom pro preset mais próximo
- Passar o ratio exatamente como o usuário definiu

### Resultado
O `image-worker` já inclui o ratio como instrução textual ao Gemini (`Aspect ratio: 5:4`), então formatos como 5:4, 3:2, 21:9 serão respeitados diretamente pelo modelo.

