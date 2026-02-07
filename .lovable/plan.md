
# Plano: Corrigir Crash ao Gerar Imagens

## Problema Identificado

A tela fica preta ao clicar em "Gerar" porque os componentes dos nós (**PromptNode**, **MediaNode**, **SettingsNode**) estão **mutando diretamente o objeto `data`** em vez de usar atualizações imutáveis do React:

```typescript
// ❌ ERRADO - causa crash
(data as Record<string, unknown>).value = e.target.value;

// ❌ ERRADO - causa crash
(data as Record<string, unknown>).aspectRatio = value;
```

Isso viola a regra de imutabilidade do React e React Flow. Quando a função `handleGenerate` tenta atualizar o Output Node via `setNodes`, o estado interno fica inconsistente e causa o crash.

**Por que funciona às vezes?** A imagem é gerada porque a Edge Function executa corretamente. O crash acontece **depois**, quando o frontend tenta atualizar o canvas com as novas imagens.

---

## Solução

Substituir todas as mutações diretas por atualizações imutáveis usando `setNodes` do React Flow.

### Padrão Correto

```typescript
// ✅ CORRETO - atualização imutável
const handleValueChange = (newValue: string) => {
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, value: newValue } }
        : node
    )
  );
};
```

---

## Arquivos a Modificar

| Arquivo | Problema | Correção |
|---------|----------|----------|
| `src/components/nodes/PromptNode.tsx` | `data.value = e.target.value` | Usar `setNodes` para atualizar |
| `src/components/nodes/MediaNode.tsx` | `data.url = newUrl` | Usar `setNodes` para atualizar |
| `src/components/nodes/SettingsNode.tsx` | `data.aspectRatio` e `data.quantity` mutados | Usar `setNodes` para atualizar |

---

## Mudanças Detalhadas

### 1. PromptNode.tsx

**Antes (linha 70-72):**
```typescript
onChange={e => {
  setValue(e.target.value);
  (data as Record<string, unknown>).value = e.target.value;
}}
```

**Depois:**
```typescript
const handleValueChange = useCallback((newValue: string) => {
  setValue(newValue);
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, value: newValue } }
        : node
    )
  );
}, [id, setNodes]);

// No Textarea:
onChange={e => handleValueChange(e.target.value)}
```

### 2. MediaNode.tsx

**Antes (linhas 38-42):**
```typescript
const handleUrlChange = (newUrl: string | null, libraryPrompt?: string | null) => {
  setUrl(newUrl);
  (data as Record<string, unknown>).url = newUrl;
  (data as Record<string, unknown>).libraryPrompt = libraryPrompt || null;
};
```

**Depois:**
```typescript
const handleUrlChange = useCallback((newUrl: string | null, libraryPrompt?: string | null) => {
  setUrl(newUrl);
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, url: newUrl, libraryPrompt: libraryPrompt || null } }
        : node
    )
  );
}, [id, setNodes]);
```

### 3. SettingsNode.tsx

**Antes (linhas 55-62):**
```typescript
const handleAspectChange = (value: string) => {
  setAspectRatio(value);
  (data as Record<string, unknown>).aspectRatio = value;
};

const handleQuantityChange = (value: number) => {
  setQuantity(value);
  (data as Record<string, unknown>).quantity = value;
};
```

**Depois:**
```typescript
const handleAspectChange = useCallback((value: string) => {
  setAspectRatio(value);
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, aspectRatio: value } }
        : node
    )
  );
}, [id, setNodes]);

const handleQuantityChange = useCallback((value: number) => {
  setQuantity(value);
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, quantity: value } }
        : node
    )
  );
}, [id, setNodes]);
```

---

## Por Que Isso Resolve

1. **Imutabilidade preservada** - React e React Flow conseguem detectar as mudanças corretamente
2. **Estado consistente** - Não há conflito entre estado local e estado global do flow
3. **Auto-save funciona** - O debounce no Editor.tsx vai capturar as mudanças via `setNodes`
4. **Sem crashes** - A atualização após geração não conflita com estado mutado

---

## Resultado Esperado

Após as correções:
- Clicar em "Gerar" executará a geração **sem crashar**
- As imagens aparecerão no Output Node normalmente
- O canvas será salvo automaticamente
- Nenhuma tela preta aparecerá

---

## Código Completo dos Componentes (Resumo Técnico)

Cada componente precisará:
1. Importar `useCallback` do React
2. Substituir mutações diretas por `setNodes` com spread operator
3. Envolver os handlers em `useCallback` para performance
