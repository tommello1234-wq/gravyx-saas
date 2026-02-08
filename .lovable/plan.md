
# Plano: Correção dos Bugs do Sistema de Geração

## ✅ IMPLEMENTADO

### Bug 1: Status "Gerando" termina antes da imagem aparecer
**Solução:** Removido o dispatch de `isGenerating: false` após a API retornar. Agora o estado é controlado pelo `RESULT_JOB_QUEUE_STATE_EVENT` que é disparado por `resultId` específico quando os jobs mudam de status.

### Bug 2: Imagem aparece em todos os Result Nodes
**Solução:** O `resultId` agora é enviado na API, armazenado no payload do job, e rastreado pelo `useJobQueue`. Quando o job completa, o `handleJobCompleted` usa o `resultId` para entregar as imagens apenas ao node correto.

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-image/index.ts` | Aceita e armazena `resultId` no payload |
| `src/pages/Editor.tsx` | Envia `resultId` na API, mapeia jobs por resultId, entrega imagens corretamente, dispara eventos por resultId |
| `src/hooks/useJobQueue.ts` | Interface `PendingJob` inclui `resultId`, `addPendingJob` aceita `resultId`, `processJobUpdate` passa `resultId` para callback |

---

## Fluxo Implementado

```text
1. Usuário clica "Gerar" no Result Node X
2. Editor envia request com resultId=X
3. Edge Function armazena resultId no payload do job
4. Editor chama addPendingJob(jobId, quantity, resultId)
5. useEffect detecta mudança em pendingJobs
6. Dispara RESULT_JOB_QUEUE_STATE_EVENT com resultId=X
7. Result Node X mostra "Na fila..." ou "Gerando..."
8. Job completa, useJobQueue notifica com resultId
9. handleJobCompleted usa o resultId para encontrar Result Node X
10. Imagens são adicionadas APENAS ao Result Node X
11. pendingJobs é atualizado, useEffect dispara evento com hasProcessingJobs=false
12. Result Node X mostra botão normal "Gerar"
```
