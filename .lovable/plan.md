

# Correcao de 3 Bugs + Exclusao em Massa na Galeria

## Problemas Identificados

### 1. Geracao parcial de imagens (pediu 4, veio 1 ou 2)

**Causa**: A API de IA (Gemini) falha silenciosamente em algumas chamadas individuais. O worker ja trata isso: gera as que conseguiu, reembolsa creditos das que falharam. Porem, o usuario so ve o toast "X imagens geradas com sucesso" sem nenhuma indicacao de que algumas falharam.

**Dados reais encontrados**: Dos ultimos 20 jobs, pelo menos 4 tiveram falhas parciais (4 pedidas, 1-3 entregues). Os creditos foram reembolsados corretamente na maioria.

**Correcao**: Adicionar ao toast uma mensagem clara quando houver falha parcial, ex: "2 de 4 imagens geradas. 2 creditos reembolsados." O `image-worker` ja retorna `imagesGenerated` e `imagesFailed` -- basta o frontend exibir isso. O `handleJobCompleted` no Editor.tsx vai comparar `resultCount` com a `quantity` do job pendente e exibir aviso quando forem diferentes.

### 2. Creditos pulando de 64 para ~100

**Causa**: O reembolso de creditos no `image-worker` usa o padrao **read-then-write** (le o saldo, soma, escreve de volta). Isso causa race conditions quando multiplos polls do worker acontecem em paralelo (a cada 3 segundos). Alem disso, jobs com retries podem reembolsar multiplas vezes: cada tentativa de retry que falha parcialmente faz um reembolso separado.

Exemplo concreto: job `da85a596` teve 2 retries, cada um possivelmente reembolsando creditos separadamente.

**Correcao**: Substituir o reembolso por uma operacao atomica. Criar uma funcao SQL `increment_credits` (similar a `decrement_credits` que ja existe) e usa-la no worker em vez do padrao read-then-write.

### 3. Galeria: exclusao nao atualiza UI + falta exclusao em massa

**Causa**: O `deleteMutation` usa `invalidateQueries` que dispara um refetch assincrono. A imagem continua visivel ate o refetch completar. Nao ha atualizacao otimista.

**Correcao**:
- Adicionar **optimistic update** no `deleteMutation`: remover a imagem da lista local imediatamente, antes do refetch
- Adicionar modo de **selecao em massa** com checkbox em cada imagem e botao "Excluir selecionadas"

---

## Alteracoes Tecnicas

### Arquivo 1: `supabase/functions/image-worker/index.ts`

Substituir os 3 trechos de reembolso (linhas ~237-248, ~340-352, e o refund no catch) por chamadas atomicas:

```typescript
// Antes (race condition):
const { data: currentProfile } = await supabaseAdmin
  .from('profiles').select('credits').eq('user_id', ...).single();
await supabaseAdmin.from('profiles')
  .update({ credits: currentProfile.credits + refundAmount }).eq('user_id', ...);

// Depois (atomico):
await supabaseAdmin.rpc('increment_credits', { uid: claimedJob.user_id, amount: refundAmount });
```

### Arquivo 2: Migracao SQL

Criar funcao `increment_credits`:

```sql
CREATE OR REPLACE FUNCTION public.increment_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_credits integer;
BEGIN
  UPDATE public.profiles
  SET credits = credits + amount, updated_at = now()
  WHERE user_id = uid
  RETURNING credits INTO new_credits;
  RETURN new_credits;
END;
$$;
```

### Arquivo 3: `src/pages/Editor.tsx`

No `handleJobCompleted`, adicionar logica para detectar falha parcial:

```typescript
// Comparar quantity pedida vs resultCount recebido
const pendingJob = pendingJobs.find(j => j.id === result.jobId);
const requestedQty = pendingJob?.quantity || result.resultCount;
const failedCount = requestedQty - result.resultCount;

if (failedCount > 0) {
  toast({
    title: `${result.resultCount} de ${requestedQty} imagens geradas`,
    description: `${failedCount} ${failedCount === 1 ? 'credito reembolsado' : 'creditos reembolsados'}.`,
    variant: 'default'
  });
} else {
  toast({ title: `${result.resultCount} ${result.resultCount === 1 ? 'imagem gerada' : 'imagens geradas'} com sucesso!` });
}
```

### Arquivo 4: `src/pages/Gallery.tsx`

**Optimistic delete**: No `deleteMutation`, usar `onMutate` para remover a imagem da cache imediatamente:

```typescript
const deleteMutation = useMutation({
  mutationFn: async (id: string) => { ... },
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['gallery', user?.id] });
    const previous = queryClient.getQueryData(['gallery', user?.id]);
    queryClient.setQueryData(['gallery', user?.id], (old: Generation[] | undefined) =>
      old?.filter(g => g.id !== id) || []
    );
    return { previous };
  },
  onError: (err, id, context) => {
    queryClient.setQueryData(['gallery', user?.id], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['gallery', user?.id] });
  },
});
```

**Exclusao em massa**: Adicionar:
- Estado `selectionMode` (boolean) e `selectedIds` (Set)
- Botao "Selecionar" no header que ativa o modo de selecao
- Checkboxes nas imagens quando em modo de selecao
- Barra flutuante no rodape com "X selecionadas | Excluir todas"
- `bulkDeleteMutation` que deleta todas as selecionadas em sequencia com optimistic update

**Bulk delete mutation**:

```typescript
const bulkDeleteMutation = useMutation({
  mutationFn: async (ids: string[]) => {
    for (const id of ids) {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
    }
  },
  onMutate: async (ids) => {
    await queryClient.cancelQueries({ queryKey: ['gallery', user?.id] });
    const previous = queryClient.getQueryData(['gallery', user?.id]);
    queryClient.setQueryData(['gallery', user?.id], (old: Generation[] | undefined) =>
      old?.filter(g => !ids.includes(g.id)) || []
    );
    return { previous };
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['gallery', user?.id] });
    setSelectedIds(new Set());
    setSelectionMode(false);
  },
});
```

### Arquivo 5: `supabase/functions/image-worker/index.ts` (deploy)

Apos as alteracoes, deploy da edge function atualizada.

---

## Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| Migracao SQL | Novo | Funcao `increment_credits` atomica |
| `image-worker/index.ts` | Editar | Reembolso atomico via RPC |
| `Editor.tsx` | Editar | Toast informativo para falha parcial |
| `Gallery.tsx` | Editar | Optimistic delete + selecao em massa |

