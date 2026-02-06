
# Plano: Corrigir Botão Gerar e Dark Mode no Editor

## Problema 1: Botão "Gerar" não funciona

### Diagnóstico
O `SettingsNode` recebe a função `onGenerate` via `data.onGenerate`, porém:

1. **Projetos carregados do banco**: Quando o `canvas_state` é carregado do Supabase, os nós são objetos JSON puros. Funções JavaScript não podem ser serializadas, então `onGenerate` fica `undefined`.

2. **Referência desatualizada**: Mesmo em nós recém-criados, o `handleGenerate` é definido com `useCallback` e captura o estado atual de `nodes`. Se o usuário adicionar mais nós, a função ainda terá a referência antiga.

### Solução
Remover a dependência de passar `onGenerate` via props e usar um **sistema de eventos ou contexto**:

```text
Opção escolhida: Criar função handleGenerate global via useCallback 
que é chamada diretamente no SettingsNode via React Flow
```

**Mudanças em Editor.tsx:**
1. Criar um efeito que atualiza os nós carregados para incluir a referência `onGenerate`
2. Usar `setNodes` para injetar a função nos nós de settings após carregar/criar

**Mudanças em SettingsNode.tsx:**
1. Receber a função via um hook customizado ou buscar do nó atualizado

### Implementação técnica
A abordagem mais limpa é atualizar os nós depois de carregados para injetar a função:

```tsx
// Em Editor.tsx - após carregar o projeto
useEffect(() => {
  setNodes(nds => nds.map(n => 
    n.type === 'settings' 
      ? { ...n, data: { ...n.data, onGenerate: handleGenerate } }
      : n
  ));
}, [handleGenerate, setNodes]);
```

---

## Problema 2: Dark Mode quebrado nos Nodes

### Diagnóstico
Classes Tailwind incorretas estão sendo usadas:

| Arquivo | Linha | Classe atual | Problema |
|---------|-------|--------------|----------|
| Editor.tsx | 299 | `bg-destructive-foreground` | Foreground = branco |
| PromptNode.tsx | 46 | `bg-popover-foreground` | Foreground = branco |
| PromptNode.tsx | 72 | `bg-warning-foreground` | Foreground = preto |

### Solução
Substituir pelas classes corretas de background:

| Arquivo | Correção |
|---------|----------|
| Editor.tsx | Remover classe ou usar `bg-background` |
| PromptNode.tsx linha 46 | `bg-card/95` (igual aos outros nós) |
| PromptNode.tsx linha 72 | `bg-card` ou remover (já tem bg-card no pai) |

---

## Arquivos a modificar

1. **src/pages/Editor.tsx**
   - Linha 299: Remover `bg-destructive-foreground` do ReactFlow
   - Adicionar `useEffect` para injetar `onGenerate` nos settings nodes carregados

2. **src/components/nodes/PromptNode.tsx**
   - Linha 46: Trocar `bg-popover-foreground` por `bg-card/95`
   - Linha 72: Remover `bg-warning-foreground` ou usar classe de background escuro

---

## Resultado esperado

- **Gerar funciona**: O botão "Gerar" funcionará tanto em nós recém-criados quanto em projetos carregados do banco
- **Dark mode**: Todo o editor (canvas, nós, backgrounds) seguirá a estética dark cyberpunk definida no design system
