
# Plano: Correção da Exibição de Imagens e Estado do Botão "Gerando"

## Problemas Identificados

### Problema 1: Imagens aparecendo em todos os Result Nodes após reload

**Causa raiz:**
No `Editor.tsx` (linhas 438-460), ao carregar o projeto, o sistema busca **todas** as imagens da tabela `generations` por `project_id` e as distribui para **TODOS** os nodes do tipo `output` ou `result`:

```typescript
loadedNodes = loadedNodes.map(node => {
  if (node.type === 'output' || node.type === 'result') {
    return {
      ...node,
      data: {
        ...node.data,
        images: historicalImages, // ← Mesmo array para TODOS os nodes!
      },
    };
  }
  return node;
});
```

**Consequência:** Não há rastreamento de qual Result Node gerou qual imagem. Toda imagem gerada é exibida em todos os Result Nodes.

---

### Problema 2: Botão "Gerando" fica travado após conclusão

**Causa raiz:**
Quando um job é restaurado do banco (jobs pendentes após refresh), o `resultId` é extraído do `payload` no `useJobQueue.ts` (linhas 45-51). Porém, ao processar a conclusão do job, a busca pelo `pendingJob` para obter o `resultId` é feita com base no estado `pendingJobs`:

```typescript
const pendingJob = pendingJobs.find(pj => pj.id === job.id);
```

Devido a uma **stale closure**, o `pendingJobs` capturado pelo `useCallback` pode estar desatualizado, fazendo com que `pendingJob` seja `undefined` e o evento `RESULT_JOB_QUEUE_STATE_EVENT` nunca seja disparado com `hasQueuedJobs: false`.

---

## Solução

### Parte 1: Rastrear imagens por Result Node

Adicionar um campo `result_node_id` à tabela `generations` e atualizar o fluxo de geração e carregamento.

#### 1.1. Nova migração SQL

```sql
-- Adiciona campo para rastrear qual node gerou a imagem
ALTER TABLE generations ADD COLUMN IF NOT EXISTS result_node_id TEXT;

-- Índice para consultas eficientes por node
CREATE INDEX IF NOT EXISTS idx_generations_result_node_id 
  ON generations(result_node_id) WHERE result_node_id IS NOT NULL;
```

#### 1.2. Atualizar Edge Function `image-worker`

Ao criar os registros na tabela `generations`, incluir o `resultId` do payload:

```typescript
const resultId = job.payload.resultId;

// Ao inserir na tabela generations:
await supabaseAdmin.from('generations').insert({
  // ...outros campos
  result_node_id: resultId || null,
});
```

#### 1.3. Atualizar carregamento no `Editor.tsx`

Modificar a lógica para carregar imagens específicas de cada Result Node:

```typescript
// Buscar gerações COM result_node_id
const { data: generations } = await supabase
  .from('generations')
  .select('image_url, prompt, aspect_ratio, created_at, result_node_id')
  .eq('project_id', projectId)
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(200);

// Agrupar imagens por result_node_id
const imagesByNode = new Map<string, NodeImage[]>();

generations?.forEach(gen => {
  const nodeId = gen.result_node_id || '__shared__'; // Fallback para imagens antigas
  const existing = imagesByNode.get(nodeId) || [];
  existing.push({
    url: gen.image_url,
    prompt: gen.prompt,
    aspectRatio: gen.aspect_ratio,
    savedToGallery: true,
    generatedAt: gen.created_at,
  });
  imagesByNode.set(nodeId, existing);
});

// Imagens sem node específico (legado) vão para o primeiro Result Node
const sharedImages = imagesByNode.get('__shared__') || [];

loadedNodes = loadedNodes.map((node, index) => {
  if (node.type === 'result') {
    const nodeImages = imagesByNode.get(node.id) || [];
    // Se for o primeiro Result Node e houver imagens legado, incluir também
    const isFirstResult = loadedNodes.filter(n => n.type === 'result').indexOf(node) === 0;
    const finalImages = isFirstResult 
      ? [...nodeImages, ...sharedImages].reverse()
      : nodeImages.reverse();
    return {
      ...node,
      data: { ...node.data, images: finalImages },
    };
  }
  return node;
});
```

---

### Parte 2: Corrigir estado travado do botão "Gerando"

#### 2.1. Usar `useRef` para pendingJobs no `processJobUpdate`

Problema: O callback `processJobUpdate` captura uma versão stale de `pendingJobs`. 

Solução: Usar um `ref` que sempre aponta para o valor atual:

```typescript
// Em useJobQueue.ts, adicionar:
const pendingJobsRef = useRef<PendingJob[]>([]);

useEffect(() => {
  pendingJobsRef.current = pendingJobs;
}, [pendingJobs]);

// Em processJobUpdate, trocar:
const pendingJob = pendingJobs.find(pj => pj.id === job.id);

// Por:
const pendingJob = pendingJobsRef.current.find(pj => pj.id === job.id);
```

#### 2.2. Garantir que resultId seja propagado do job do banco

Ao restaurar jobs pendentes no `useEffect` inicial, já está pegando o `resultId` do payload. Precisamos garantir que ao processar o job via Realtime/polling, o `resultId` também seja passado.

Modificar `processJobUpdate` para buscar o `resultId` diretamente do banco se não estiver no `pendingJob`:

```typescript
const processJobUpdate = useCallback(async (job: {
  id: string;
  status: string;
  result_urls: string[] | null;
  result_count: number | null;
  error: string | null;
  payload?: { resultId?: string }; // Adicionar payload
}) => {
  // ...
  
  // Primeiro tenta do pendingJobs, depois do payload do próprio job
  const pendingJob = pendingJobsRef.current.find(pj => pj.id === job.id);
  const resultId = pendingJob?.resultId || job.payload?.resultId;
  
  if (job.status === 'completed') {
    callbacksRef.current.onJobCompleted({
      jobId: job.id,
      resultUrls: urls,
      resultCount: job.result_count || urls.length,
      resultId // Usar o resultId encontrado
    });
    // ...
  }
}, [removePendingJob, updateJobStatus]); // Remover pendingJobs das deps
```

#### 2.3. Atualizar query do status polling para incluir payload

```typescript
const { data, error } = await supabase
  .from('jobs')
  .select('id,status,result_urls,result_count,error,payload') // Adicionar payload
  .in('id', ids);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/[timestamp]_add_result_node_id.sql` | Nova coluna `result_node_id` |
| `src/integrations/supabase/types.ts` | Atualizar tipos (regenerar) |
| `supabase/functions/image-worker/index.ts` | Salvar `result_node_id` |
| `src/pages/Editor.tsx` | Carregar imagens por node |
| `src/hooks/useJobQueue.ts` | Usar ref + buscar resultId do payload |

---

## Compatibilidade Retroativa

- Imagens já geradas (sem `result_node_id`) serão exibidas no **primeiro** Result Node encontrado, mantendo o comportamento atual para projetos antigos.
- Novos jobs terão o `resultId` persistido na tabela `generations`, garantindo isolamento correto.

---

## Fluxo de Dados Corrigido

```text
┌──────────────────────────────────────────────────────────────────┐
│  GERAÇÃO                                                         │
├──────────────────────────────────────────────────────────────────┤
│  1. ResultNode dispara evento com resultId                       │
│  2. generate-image cria job com resultId no payload              │
│  3. image-worker processa e salva generation com result_node_id  │
│  4. useJobQueue recebe update e propaga resultId                 │
│  5. Editor adiciona imagem APENAS ao node correto                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  CARREGAMENTO (após refresh)                                     │
├──────────────────────────────────────────────────────────────────┤
│  1. Busca generations com result_node_id                         │
│  2. Agrupa imagens por node ID                                   │
│  3. Cada ResultNode recebe APENAS suas próprias imagens          │
│  4. Jobs pendentes restaurados disparam eventos por resultId     │
└──────────────────────────────────────────────────────────────────┘
```
