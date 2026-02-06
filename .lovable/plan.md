

# Plano: Corrigir Loop Infinito de Requisições no Editor

## Problema Identificado

Encontrei um **bug crítico** no código do Editor que está causando um loop infinito de requisições ao Supabase:

```text
+------------------+     depende de      +------------------+
|  handleGenerate  | <------------------ |      nodes       |
+------------------+                      +------------------+
         |                                       ^
         | quando muda                           |
         v                                       |
+------------------+     atualiza                |
|    useEffect     | -------------------------->-+
| (injeta onGenerate)  
+------------------+
```

**O ciclo funciona assim:**
1. `handleGenerate` tem `nodes` nas dependências (linha 244)
2. Quando `handleGenerate` muda, o `useEffect` (linha 247) injeta a função nos nodes
3. Isso muda `nodes`, que recria `handleGenerate`, que dispara o `useEffect` novamente
4. Isso acontece continuamente, disparando o auto-save a cada 1.5s

Este loop está gerando as milhares de requisições que você viu no dashboard (3.9k requests).

---

## Solução

### 1. Usar `useRef` para armazenar `handleGenerate`

Em vez de colocar a função no estado dos nodes (que dispara re-renders), vou usar uma referência estável que não causa re-renderização.

**Mudanças no `Editor.tsx`:**

```typescript
// Adicionar ref para armazenar handleGenerate
const handleGenerateRef = useRef<() => Promise<void>>();

// Atualizar a ref quando handleGenerate mudar (sem causar re-render dos nodes)
useEffect(() => {
  handleGenerateRef.current = handleGenerate;
}, [handleGenerate]);

// REMOVER o useEffect que injeta onGenerate nos nodes (linhas 247-253)
// Em vez disso, passar a ref diretamente nos dados iniciais
```

### 2. Modificar o SettingsNode para usar a ref

**Mudanças no `SettingsNode.tsx`:**

Ao invés de receber `onGenerate` como prop direta, o node vai receber uma função wrapper estável ou usar um evento customizado.

### 3. Remover `nodes` das dependências de `handleGenerate`

Usar `setNodes` com callback funcional para acessar o estado atual dos nodes sem depender deles:

```typescript
const handleGenerate = useCallback(async () => {
  // Em vez de: const settingsNode = nodes.find(...)
  // Usar: setNodes(currentNodes => { const settingsNode = currentNodes.find(...) })
  
  setNodes((currentNodes) => {
    // Lógica de validação usando currentNodes
    // Retorna os nodes sem modificação ou com loading state
  });
}, [edges, profile, projectId, toast, saveProject]); // SEM nodes!
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Editor.tsx` | Refatorar para usar ref e remover loop |
| `src/components/nodes/SettingsNode.tsx` | Adaptar para novo padrão |

---

## Benefícios

- Elimina o loop infinito de requisições
- Reduz drasticamente o uso de rede
- Melhora a performance do editor
- Resolve os erros de "Failed to fetch" causados por rate limiting

