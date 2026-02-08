
# Plano: Correção dos Bugs do Sistema de Geração

## Bugs Identificados

### Bug 1: Status "Gerando" termina antes da imagem aparecer

**Causa Raiz:** Após clicar em "Gerar", o status `isGenerating` é setado para `false` assim que a API retorna o `jobId`, mas o job ainda está sendo processado. O sistema deveria manter o estado de "gerando" até o job completar.

**Localização:** `Editor.tsx` linha 563-565

```typescript
// PROBLEMA: Desativa isGenerating logo após enfileirar
window.dispatchEvent(new CustomEvent(RESULT_GENERATING_STATE_EVENT, { 
  detail: { resultId, isGenerating: false } 
}));
```

---

### Bug 2: Imagem aparece em todos os Result Nodes

**Causa Raiz:** A função `handleJobCompleted` não sabe qual Result Node iniciou o job. Ela simplesmente pega o primeiro Result Node que encontra:

```typescript
// PROBLEMA: Pega o primeiro result node, não o correto
let targetNode = currentNodes.find((n) => n.type === 'result');
```

**Localização:** `Editor.tsx` linhas 226-235

---

## Solução Proposta

### Mudança 1: Associar Job ao Result Node

Armazenar o `resultId` no payload do job para saber onde entregar as imagens.

**Arquivo:** `supabase/functions/generate-image/index.ts`

```typescript
// ANTES
payload: {
  prompt,
  aspectRatio: aspectRatio || '1:1',
  quantity: safeQuantity,
  imageUrls
}

// DEPOIS
payload: {
  prompt,
  aspectRatio: aspectRatio || '1:1',
  quantity: safeQuantity,
  imageUrls,
  resultId  // <- NOVO: ID do Result Node
}
```

---

### Mudança 2: Enviar resultId na chamada da API

**Arquivo:** `src/pages/Editor.tsx` (função `generateForResult`)

```typescript
// ANTES
const { data, error } = await supabase.functions.invoke('generate-image', {
  body: { prompt, aspectRatio, quantity, imageUrls: allMedias, projectId }
});

// DEPOIS
const { data, error } = await supabase.functions.invoke('generate-image', {
  body: { prompt, aspectRatio, quantity, imageUrls: allMedias, projectId, resultId }
});
```

---

### Mudança 3: Rastrear jobs por Result Node

Criar um mapeamento de `jobId -> resultId` para saber onde entregar as imagens quando o job completar.

**Arquivo:** `src/pages/Editor.tsx`

```typescript
// NOVO: Mapeamento de jobs para result nodes
const jobToResultMapRef = useRef<Map<string, string>>(new Map());

// Na função generateForResult, após enfileirar o job:
jobToResultMapRef.current.set(data.jobId, resultId);
```

---

### Mudança 4: Entregar imagens ao Result Node correto

**Arquivo:** `src/pages/Editor.tsx` (função `handleJobCompleted`)

```typescript
// ANTES
let targetNode = currentNodes.find((n) => n.type === 'result');

// DEPOIS
const resultId = jobToResultMapRef.current.get(result.jobId);
let targetNode = resultId 
  ? currentNodes.find((n) => n.id === resultId)
  : currentNodes.find((n) => n.type === 'result' || n.type === 'output');

// Limpar o mapeamento após uso
if (resultId) {
  jobToResultMapRef.current.delete(result.jobId);
}
```

---

### Mudança 5: Manter estado de "gerando" por Result Node

Disparar eventos de job queue específicos por `resultId` para que cada Result Node saiba seu próprio estado.

**Arquivo:** `src/hooks/useJobQueue.ts`

Adicionar suporte para rastrear `resultId` por job:

```typescript
interface PendingJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  quantity: number;
  createdAt: string;
  resultId?: string;  // <- NOVO
}
```

**Arquivo:** `src/pages/Editor.tsx`

Atualizar o `addPendingJob` para incluir `resultId` e disparar eventos específicos:

```typescript
// Ao adicionar job
addPendingJob(data.jobId, data.quantity, resultId);

// Não desativar isGenerating imediatamente - deixar o job queue state controlar
// REMOVER: window.dispatchEvent(new CustomEvent(RESULT_GENERATING_STATE_EVENT, { 
//   detail: { resultId, isGenerating: false } 
// }));
```

Disparar `RESULT_JOB_QUEUE_STATE_EVENT` com o `resultId` correto quando jobs mudam de status.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-image/index.ts` | Aceitar e armazenar `resultId` no payload |
| `src/pages/Editor.tsx` | Enviar `resultId` na API, mapear jobs, entregar imagens corretamente |
| `src/hooks/useJobQueue.ts` | Rastrear `resultId` por job, disparar eventos específicos |

---

## Fluxo Corrigido

```text
1. Usuário clica "Gerar" no Result Node X
2. Editor envia request com resultId=X
3. Edge Function armazena resultId no payload do job
4. Editor mapeia jobId -> resultId
5. useJobQueue atualiza e dispara RESULT_JOB_QUEUE_STATE_EVENT com resultId=X
6. Result Node X mostra "Na fila..." ou "Gerando..."
7. Job completa, useJobQueue notifica
8. handleJobCompleted usa o mapeamento para encontrar Result Node X
9. Imagens são adicionadas APENAS ao Result Node X
10. RESULT_JOB_QUEUE_STATE_EVENT é disparado com resultId=X, hasProcessingJobs=false
11. Result Node X mostra botão normal "Gerar"
```

---

## Detalhes Técnicos de Implementação

### Mudança no useJobQueue.ts

```typescript
// Novo: addPendingJob com resultId opcional
const addPendingJob = useCallback((jobId: string, quantity: number, resultId?: string) => {
  // ...
  setPendingJobs((prev) => [
    ...prev,
    {
      id: jobId,
      status: 'queued',
      quantity,
      createdAt: new Date().toISOString(),
      resultId  // <- NOVO
    }
  ]);
}, []);
```

### Disparo de Eventos por ResultId

No Editor.tsx, após cada mudança no `pendingJobs`, calcular e disparar eventos específicos por resultId:

```typescript
useEffect(() => {
  // Agrupar jobs por resultId
  const jobsByResult = new Map<string, PendingJob[]>();
  
  for (const job of pendingJobs) {
    if (job.resultId) {
      const jobs = jobsByResult.get(job.resultId) || [];
      jobs.push(job);
      jobsByResult.set(job.resultId, jobs);
    }
  }
  
  // Disparar evento para cada resultId
  for (const [resultId, jobs] of jobsByResult) {
    const hasQueuedJobs = jobs.some(j => j.status === 'queued');
    const hasProcessingJobs = jobs.some(j => j.status === 'processing');
    const totalPendingImages = jobs.reduce((acc, j) => acc + j.quantity, 0);
    
    window.dispatchEvent(new CustomEvent(RESULT_JOB_QUEUE_STATE_EVENT, {
      detail: { resultId, hasQueuedJobs, hasProcessingJobs, totalPendingImages }
    }));
  }
}, [pendingJobs]);
```

---

## Resumo das Correções

| Bug | Causa | Solução |
|-----|-------|---------|
| Status termina antes | `isGenerating=false` após API retornar | Manter baseado em job queue state por resultId |
| Imagem em todos os nodes | Sem associação job-result | Mapear jobId -> resultId e entregar corretamente |
