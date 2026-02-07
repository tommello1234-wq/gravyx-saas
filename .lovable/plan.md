
# Plano: Correção de Exibição em Tempo Real e Scroll do MediaNode

## Problema 1: Imagens não aparecem em tempo real no Output Node

### Diagnóstico
Os jobs estão sendo processados corretamente (verificado no banco de dados - todos com status `completed` e URLs válidas). O problema é que a atualização em tempo real não está funcionando em todos os navegadores/contextos:

1. **O Realtime do Supabase está funcionando** - jobs completam e as URLs são salvas
2. **O problema está na sincronização do estado React** - quando `handleJobCompleted` é chamado, ele usa `setNodesRef.current` que pode estar dessincronizado em certos navegadores Windows/mobile
3. **A inscrição Realtime pode falhar silenciosamente** - não há feedback visual quando a conexão Realtime falha

### Solução
1. Adicionar estado local para forçar re-render quando jobs completam
2. Implementar fallback com polling para garantir atualização mesmo sem Realtime
3. Adicionar logging mais detalhado para debug
4. Melhorar a robustez da sincronização de estado

**Arquivos a modificar:**
- `src/pages/Editor.tsx` - Adicionar state para forçar re-render e fallback
- `src/hooks/useJobQueue.ts` - Melhorar logging e tratamento de conexão Realtime

---

## Problema 2: Scroll do MediaNode não funciona com a rodinha do mouse

### Diagnóstico
O React Flow captura eventos de scroll (wheel) para controlar zoom e pan do canvas. Quando há elementos internos que precisam de scroll (como a área de seleção de categorias do LibraryModal dentro do MediaNode), o evento não chega ao elemento.

### Solução
Adicionar a classe `nowheel` e `onWheel={e => e.stopPropagation()}` nos containers internos que precisam de scroll.

**Arquivos a modificar:**
- `src/components/nodes/MediaNode.tsx` - Adicionar tratamento de wheel events
- `src/components/nodes/LibraryModal.tsx` - Garantir que ScrollArea funcione corretamente dentro do canvas

---

## Detalhes Técnicos

### Correção 1: Sincronização de estado no Editor.tsx

Adicionar um mecanismo de fallback que verifica periodicamente se há imagens novas no banco que não estão no estado local:

```typescript
// Adicionar estado para tracking de última atualização
const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

// No handleJobCompleted, forçar update
const handleJobCompleted = useCallback((result) => {
  // ... código existente ...
  
  // Forçar re-render atualizando timestamp
  setLastUpdateTime(Date.now());
}, []);

// Adicionar polling fallback a cada 5 segundos quando há jobs pendentes
useEffect(() => {
  if (pendingJobs.length === 0) return;
  
  const interval = setInterval(async () => {
    // Verificar se há imagens novas no banco
    const { data } = await supabase
      .from('generations')
      .select('image_url, prompt, aspect_ratio, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Comparar e atualizar se necessário
  }, 5000);
  
  return () => clearInterval(interval);
}, [pendingJobs.length, projectId]);
```

### Correção 2: Scroll do MediaNode

Adicionar classe `nowheel` e handler de wheel events:

```tsx
// Em MediaNode.tsx - envolver conteúdo scrollável
<div 
  className="nowheel" 
  onWheel={(e) => e.stopPropagation()}
>
  <Tabs ...>
    ...
  </Tabs>
</div>
```

### Correção 3: ScrollArea no LibraryModal

O `ScrollArea` do LibraryModal precisa bloquear propagação do wheel event:

```tsx
<ScrollArea 
  className="h-[45vh] pr-4 nowheel"
  onWheel={(e) => e.stopPropagation()}
>
  ...
</ScrollArea>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Editor.tsx` | Adicionar fallback polling e melhorar sincronização de estado |
| `src/hooks/useJobQueue.ts` | Melhorar logging do Realtime e tratamento de erros de conexão |
| `src/components/nodes/MediaNode.tsx` | Adicionar `nowheel` e `onWheel` handler |
| `src/components/nodes/LibraryModal.tsx` | Adicionar `nowheel` no ScrollArea |

---

## Resultado Esperado

1. **Problema 1**: As imagens aparecerão no Output Node assim que forem geradas, mesmo em navegadores Windows ou em conexões instáveis
2. **Problema 2**: O scroll com a rodinha do mouse funcionará corretamente dentro das áreas de seleção do MediaNode e LibraryModal
