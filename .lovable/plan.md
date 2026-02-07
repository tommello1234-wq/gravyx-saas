

# Plano: Corrigir Conflito da Função `claim_next_job`

## Problema Identificado

O Supabase AI criou uma função `claim_next_job(p_worker_id uuid)`, mas já existia outra versão com parâmetros diferentes `claim_next_job(p_concurrency_per_user, p_global_concurrency)`. 

Quando o `image-worker` chama `rpc('claim_next_job')` sem parâmetros, o PostgREST não consegue decidir qual função usar e retorna erro PGRST203.

**Resultado**: Todos os 6 jobs estão presos em `queued` há mais de 10 minutos.

---

## Solução

### 1. Remover a função duplicada via SQL

Preciso pedir para você executar no Supabase (SQL Editor):

```sql
-- Remover a versão antiga que tem parâmetros de concorrência
DROP FUNCTION IF EXISTS public.claim_next_job(integer, integer);
```

Isso vai manter apenas a versão nova (com `p_worker_id uuid`) que o worker usa.

### 2. Atualizar o `image-worker` para chamar explicitamente

Alterar a chamada RPC para passar o parâmetro esperado:

```typescript
// Antes
const { data: job, error: claimError } = await supabaseAdmin.rpc('claim_next_job');

// Depois  
const { data: job, error: claimError } = await supabaseAdmin.rpc('claim_next_job', {
  p_worker_id: crypto.randomUUID()
});
```

### 3. Reprocessar jobs presos

Após a correção, os 6 jobs em `queued` serão processados automaticamente pelo polling do frontend.

---

## O que você precisa fazer

Executar no Supabase SQL Editor (Cloud View > Run SQL):

```sql
DROP FUNCTION IF EXISTS public.claim_next_job(integer, integer);
```

Depois me avise que executou para eu atualizar o `image-worker`.

---

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/image-worker/index.ts` | Passar `p_worker_id` explicitamente na chamada RPC |

---

## Alternativa (se preferir manter controle de concorrência)

Se quiser manter o controle de concorrência da função antiga, posso:
1. Remover a função nova do Supabase AI
2. Atualizar o worker para usar a função antiga com os parâmetros de concorrência

Mas a versão nova é mais simples e o controle de concorrência pode ser feito de outras formas.

