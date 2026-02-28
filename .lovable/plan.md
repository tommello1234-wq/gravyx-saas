

## Plano: Aumentar limite de imagens de referência para 20MB

### 1. `supabase/functions/image-worker/index.ts`
- Alterar `MAX_REF_IMAGE_BYTES` de `4 * 1024 * 1024` para `20 * 1024 * 1024`
- Atualizar mensagens de log para refletir o novo limite

### 2. `src/components/nodes/MediaNode.tsx`
- No `handleFileSelect`, antes do upload, verificar se `file.size > 20 * 1024 * 1024`
- Se exceder, mostrar toast de erro com mensagem indicando o limite de 20MB e retornar sem fazer upload

### Arquivos impactados
| Arquivo | Alteração |
|---|---|
| `supabase/functions/image-worker/index.ts` | Constante 4MB → 20MB |
| `src/components/nodes/MediaNode.tsx` | Validação de tamanho no upload com toast de erro |

Deploy do `image-worker` necessário (automático).

