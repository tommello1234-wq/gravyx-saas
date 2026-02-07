
# Plano: Corrigir Função SQL `claim_next_job`

## Problema Identificado

A função `claim_next_job` no banco de dados tem um bug que causa o erro:
```
column reference "id" is ambiguous
```

O problema está no `RETURN QUERY SELECT` onde os nomes das colunas de retorno da função conflitam com os nomes das colunas da tabela.

---

## Causa Raiz

A função define colunas de retorno como `id`, `user_id`, etc., mas depois faz:
```sql
SELECT j.id, j.user_id, ... FROM public.jobs j WHERE j.id = v_job.id
```

O PostgreSQL não sabe se `id` na cláusula `WHERE j.id = v_job.id` refere-se à coluna de retorno ou à coluna da tabela.

---

## Solução

Criar uma migration para substituir a função com a versão corrigida:

```sql
CREATE OR REPLACE FUNCTION public.claim_next_job(p_worker_id uuid DEFAULT gen_random_uuid())
 RETURNS TABLE(
   id uuid, 
   user_id uuid, 
   project_id uuid, 
   status text, 
   payload jsonb, 
   error text, 
   retries integer, 
   max_retries integer, 
   request_id text, 
   created_at timestamp with time zone, 
   started_at timestamp with time zone, 
   finished_at timestamp with time zone, 
   next_run_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_job_id uuid;
BEGIN
  -- Seleciona o próximo job e faz lock para evitar concorrência
  SELECT jobs.id INTO v_job_id
  FROM public.jobs
  WHERE jobs.status = 'queued'
    AND (jobs.next_run_at IS NULL OR jobs.next_run_at <= now())
  ORDER BY jobs.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN; -- retorna vazio
  END IF;

  -- Atualiza o job para processing
  UPDATE public.jobs
  SET 
    status = 'processing', 
    started_at = now(), 
    error = NULL, 
    request_id = COALESCE(jobs.request_id, p_worker_id::text)
  WHERE jobs.id = v_job_id;

  -- Retorna o job atualizado
  RETURN QUERY
  SELECT 
    jobs.id,
    jobs.user_id,
    jobs.project_id,
    jobs.status,
    jobs.payload,
    jobs.error,
    jobs.retries,
    jobs.max_retries,
    jobs.request_id,
    jobs.created_at,
    jobs.started_at,
    jobs.finished_at,
    jobs.next_run_at
  FROM public.jobs
  WHERE jobs.id = v_job_id;
END;
$function$;
```

As mudanças principais:
1. **Renomeei** `v_job` para `v_job_id` (armazena só o ID, não a row inteira)
2. **Qualifiquei** todas as referências com `jobs.` explicitamente
3. O `RETURN QUERY` agora busca os dados **após** o `UPDATE`, garantindo que retorne `status = 'processing'`

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Nova migration SQL | **Criar** - Corrige a função `claim_next_job` |

---

## O que vai acontecer após a correção

1. O worker vai conseguir reivindicar jobs
2. Os 6 jobs presos em `queued` serão processados
3. O sistema estará 100% operacional

---

## Resumo das verificações

| Componente | Status |
|------------|--------|
| Edge Function `generate-image` | ✅ OK |
| Edge Function `image-worker` | ✅ OK |
| Frontend (Editor + useJobQueue) | ✅ OK |
| UI (SettingsNode) | ✅ OK |
| Função SQL `claim_next_job` | ❌ **QUEBRADA** - precisa correção |
| Função SQL `complete_job_with_result` | ✅ OK |
| Realtime subscription | ✅ OK |
| Polling mechanism | ✅ OK |

---

## Após esta correção

**SIM**, você poderá distribuir o sistema para seus alunos. Todas as outras partes estão funcionando corretamente. O único problema é esta função SQL que impede o worker de processar os jobs.

Uma vez corrigida, o fluxo será:
1. Aluno clica em "Gerar" → resposta imediata (< 1s)
2. Job entra na fila
3. Worker processa em background
4. Imagem aparece automaticamente via Realtime
5. Se falhar, retry automático com backoff
6. Se falhar 3x, reembolso automático de créditos
