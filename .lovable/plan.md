
# Plano: Correções do Output Node

## Problema 1: Imagens não aparecem em tempo real

### Diagnóstico
O sistema Realtime está funcionando, MAS o hook `useJobQueue` só escuta atualizações quando `pendingJobs.length > 0`:

```typescript
// useJobQueue.ts linha 99
if (!projectId || pendingJobs.length === 0) return;
```

**Cenário do bug**: Quando você gera imagens em **outra aba/sessão** ou quando o job é processado tão rápido que a lista `pendingJobs` é limpa antes do Realtime disparar, a subscription é removida e as imagens não aparecem.

### Solução
Manter a subscription Realtime **sempre ativa** enquanto o usuário estiver no Editor, independente de haver jobs pendentes. Assim, qualquer atualização de job para o projeto será capturada e exibida.

**Mudança em `useJobQueue.ts`**:
```typescript
// ANTES (linha 99)
if (!projectId || pendingJobs.length === 0) return;

// DEPOIS
if (!projectId) return;
```

Também precisamos ajustar o callback para verificar se o job pertence à nossa lista antes de remover, evitando erros quando jobs de outras sessões chegam:

```typescript
if (job.status === 'completed' && job.result_urls) {
  callbacksRef.current.onJobCompleted({
    jobId: job.id,
    resultUrls: job.result_urls,
    resultCount: job.result_count || job.result_urls.length
  });
  // Só remove se estava na nossa lista
  if (pendingJobIds.has(job.id)) {
    removePendingJob(job.id);
  }
}
```

## Problema 2: Output Node muito extenso (15+ imagens)

### Diagnóstico
Atualmente o grid de imagens cresce indefinidamente:
```tsx
<div className="grid grid-cols-2 gap-2">
  {images.map(...)}  // Sem limite
</div>
```

### Solução
Adicionar um container com **altura máxima e scroll** a partir de 6 imagens (3 linhas no grid 2x):

**Mudança em `OutputNode.tsx`**:
```tsx
import { ScrollArea } from '@/components/ui/scroll-area';

// No Content section:
{images.length > 6 ? (
  <ScrollArea className="h-[200px]">
    <div className="grid grid-cols-2 gap-2 pr-2">
      {images.map(...)}
    </div>
  </ScrollArea>
) : (
  <div className="grid grid-cols-2 gap-2">
    {images.map(...)}
  </div>
)}
```

A altura de 200px acomoda ~3 linhas (6 imagens) confortavelmente.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useJobQueue.ts` | Manter Realtime sempre ativo para o projeto |
| `src/components/nodes/OutputNode.tsx` | Adicionar ScrollArea para +6 imagens |

## Resultado Esperado

1. **Tempo Real**: Imagens aparecem imediatamente no Output Node sem precisar recarregar
2. **Layout Compacto**: Node com scroll suave quando há mais de 6 imagens

## Detalhes Técnicos

### useJobQueue.ts
- Remover condição `pendingJobs.length === 0` da subscription Realtime
- Usar `useRef` para manter track dos jobIds pendentes e verificar antes de chamar callbacks
- Manter a lógica de polling apenas quando há jobs pendentes (economia de recursos)

### OutputNode.tsx
- Importar `ScrollArea` do Radix
- Calcular se precisa de scroll (images.length > 6)
- Aplicar altura fixa apenas quando necessário
- Manter espaçamento adequado para a scrollbar
