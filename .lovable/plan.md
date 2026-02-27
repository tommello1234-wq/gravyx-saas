

## Plano: Permitir múltiplas imagens de referência na geração

### Problema
No `image-worker/index.ts`, linha que filtra imagens de referência usa `.slice(0, 1)`, descartando todas as imagens além da primeira. Quando o usuário conecta 2 nós de Mídia (cena + rosto), apenas a primeira imagem é enviada ao Gemini.

### Implementação

1. **Alterar `supabase/functions/image-worker/index.ts`**:
   - Mudar `.slice(0, 1)` para `.slice(0, 3)` — permitir até 3 imagens de referência
   - Isso garante que tanto a imagem da cena quanto a do rosto sejam enviadas ao modelo

2. **Deploy do image-worker** para aplicar a mudança

### Detalhe técnico
O Gemini já recebe as imagens como `inline_data` parts no request — a lógica de montagem do array `parts` já itera sobre todas as URLs. O único gargalo é o `.slice(0, 1)` que limita artificialmente a quantidade.

