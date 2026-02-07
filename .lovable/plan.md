
# Plano: Correção de Erros na Geração de Imagens

## Diagnóstico

Identifiquei **dois problemas críticos** causando os erros reportados pelos usuários:

### Problema 1: Crash "Cannot read properties of undefined (reading 'map')"

**Localização**: `src/pages/Editor.tsx` linha 153

```typescript
const newImages = result.resultUrls.map(url => ({ ... }));
```

**Causa**: O callback `handleJobCompleted` assume que `resultUrls` sempre é um array válido, mas pode receber `undefined` ou `null` em edge cases:
- Payload malformado do Supabase Realtime
- Condição de corrida onde o job é marcado como `completed` antes de `result_urls` ser populado

### Problema 2: Jobs presos na fila (9 jobs `queued` sem processamento)

**Diagnóstico do banco de dados**:
```
┌─────────────────────┬──────────┬──────────────────┐
│ created_at          │ status   │ result_urls_null │
├─────────────────────┼──────────┼──────────────────┤
│ 2026-02-07 21:43:38 │ queued   │ true             │
│ 2026-02-07 21:43:11 │ queued   │ true             │
│ 2026-02-07 21:06:51 │ queued   │ true             │
│ ... (mais 6 jobs)   │ queued   │ true             │
└─────────────────────┴──────────┴──────────────────┘
```

**Causa**: O `image-worker` não está sendo invocado ou está falhando silenciosamente. Os jobs ficam eternamente `queued`.

---

## Soluções

### Correção 1: Validação defensiva no handleJobCompleted

**Arquivo**: `src/pages/Editor.tsx`

Adicionar validação para garantir que `resultUrls` é um array válido antes de fazer `.map()`:

```typescript
const handleJobCompleted = useCallback((result: { jobId: string; resultUrls: string[]; resultCount: number }) => {
  const currentNodes = nodesRef.current;
  const outputNode = currentNodes.find((n) => n.type === 'output');
  
  if (!outputNode) return;

  // CORREÇÃO: Validar resultUrls antes de usar
  const urls = Array.isArray(result.resultUrls) ? result.resultUrls : [];
  if (urls.length === 0) {
    console.warn('Job completed but no result URLs provided:', result.jobId);
    return;
  }

  const newImages = urls.map(url => ({
    url,
    prompt: '',
    aspectRatio: '1:1',
    savedToGallery: true,
    generatedAt: new Date().toISOString(),
  }));
  // ... resto do código
});
```

### Correção 2: Validação no useJobQueue antes de chamar callback

**Arquivo**: `src/hooks/useJobQueue.ts`

Adicionar verificação mais robusta no handler do Realtime:

```typescript
if (job.status === 'completed') {
  // CORREÇÃO: Validar que result_urls é um array não vazio
  const urls = job.result_urls;
  if (Array.isArray(urls) && urls.length > 0) {
    callbacksRef.current.onJobCompleted({
      jobId: job.id,
      resultUrls: urls,
      resultCount: job.result_count || urls.length
    });
  } else {
    console.error('Job completed without valid result_urls:', job.id);
  }
  // ... resto do código
}
```

### Correção 3: Melhoria no worker polling

O polling do worker está configurado corretamente, mas pode haver problemas de timeout. Adicionar tratamento de erro mais robusto:

**Arquivo**: `src/hooks/useJobQueue.ts`

```typescript
const pollWorker = useCallback(async () => {
  try {
    const { data, error } = await supabase.functions.invoke('image-worker');
    if (error) {
      console.error('Worker invocation error:', error);
    }
  } catch (error) {
    console.error('Worker poll error:', error);
  }
}, []);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Editor.tsx` | Adicionar validação defensiva em `handleJobCompleted` |
| `src/hooks/useJobQueue.ts` | Validar `result_urls` antes de chamar callback + melhorar logging do worker |

---

## Detalhes Técnicos

### Por que o erro ocorre?
1. Usuário clica em "Gerar"
2. Job é enfileirado com status `queued`
3. Worker é invocado mas pode falhar silenciosamente
4. Se o Realtime enviar um evento com `status: 'completed'` mas `result_urls: null`, o código tenta fazer `.map(null)` e crasha
5. ErrorBoundary captura o crash e mostra "Algo deu errado"

### Validação defensiva
A regra de ouro: **nunca confiar em dados externos** - sempre validar antes de usar.

### Limpeza de jobs órfãos
Após aplicar as correções, será necessário limpar os 9 jobs presos no status `queued` para evitar que sejam reprocessados incorretamente.
