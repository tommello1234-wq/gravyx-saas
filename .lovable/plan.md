

# Plano: Menu Dropdown com 3 Pontinhos nos Nodes

## Visão Geral

Substituir os ícones individuais (lápis e reset) no header dos nodes por um único botão de **três pontinhos (⋮)** que abre um dropdown menu com as seguintes opções:

1. **Duplicar** - Duplica o node com todo o conteúdo e conexões
2. **Resetar** - Limpa o conteúdo do node e remove conexões
3. **Renomear** - Abre input inline para editar o nome
4. **Excluir** - Remove o node do canvas

Também será adicionado suporte para **excluir conexões (edges)** selecionando-as e pressionando Delete.

---

## Mudanças por Arquivo

### 1. Todos os Nodes (PromptNode, MediaNode, SettingsNode, OutputNode)

**Remover:**
- Os dois botões separados (RotateCcw e Pencil)

**Adicionar:**
- Botão com ícone `MoreVertical` (três pontinhos verticais)
- `DropdownMenu` do Radix UI com 4 opções:
  - **Duplicar** (ícone Copy) - Cria cópia com conteúdo + conexões
  - **Resetar** (ícone RotateCcw) - Limpa dados e remove conexões
  - **Renomear** (ícone Pencil) - Ativa modo de edição do label
  - **Excluir** (ícone Trash2) - Remove o node

**Nova função `handleDuplicate`:**
```
const handleDuplicate = useCallback(() => {
  const currentNode = getNode(id);
  const currentEdges = getEdges();
  
  const newId = `${currentNode.type}-${Date.now()}`;
  const newNode = {
    ...currentNode,
    id: newId,
    position: { x: currentNode.position.x + 50, y: currentNode.position.y + 50 },
    selected: false,
    data: { ...currentNode.data }
  };
  
  // Recreate edges connected to this node
  const connectedEdges = currentEdges.filter(e => e.source === id || e.target === id);
  const newEdges = connectedEdges.map((edge, i) => ({
    ...edge,
    id: `edge-dup-${Date.now()}-${i}`,
    source: edge.source === id ? newId : edge.source,
    target: edge.target === id ? newId : edge.target,
  }));
  
  setNodes(nds => [...nds, newNode]);
  setEdges(eds => [...eds, ...newEdges]);
}, [id, getNode, getEdges, setNodes, setEdges]);
```

**Nova função `handleDelete`:**
```
const handleDelete = useCallback(() => {
  setNodes(nds => nds.filter(n => n.id !== id));
  setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
}, [id, setNodes, setEdges]);
```

---

### 2. Editor.tsx - Deletar Edges

O React Flow já suporta deletar edges selecionadas com Delete/Backspace quando configurado corretamente. Vou verificar e garantir que está funcionando. Se necessário, adicionarei configuração:

```jsx
<ReactFlow
  ...
  deleteKeyCode={['Backspace', 'Delete']}
  selectionOnDrag
  selectNodesOnDrag={false}
/>
```

---

## Estrutura Visual do Header

```
┌─────────────────────────────────────────┐
│ [Icon]  Nome do Node           [⋮]     │
│         Subtítulo                       │
└─────────────────────────────────────────┘

Ao clicar em [⋮]:
┌──────────────┐
│ 📋 Duplicar  │
│ 🔄 Resetar   │
│ ✏️ Renomear  │
│ ────────────│
│ 🗑️ Excluir  │
└──────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/nodes/PromptNode.tsx` | Substituir botões por dropdown menu |
| `src/components/nodes/MediaNode.tsx` | Substituir botões por dropdown menu |
| `src/components/nodes/SettingsNode.tsx` | Substituir botões por dropdown menu |
| `src/components/nodes/OutputNode.tsx` | Substituir botões por dropdown menu |
| `src/pages/Editor.tsx` | Garantir deleteKeyCode para edges |

---

## Detalhes Técnicos

### Imports necessários nos Nodes:
```typescript
import { MoreVertical, Copy, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
```

### Hooks adicionais do React Flow:
```typescript
const { setNodes, setEdges, getNode, getEdges } = useReactFlow();
```

### Estrutura do Dropdown:
```jsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-40">
    <DropdownMenuItem onClick={handleDuplicate}>
      <Copy className="h-4 w-4 mr-2" />
      Duplicar
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleReset}>
      <RotateCcw className="h-4 w-4 mr-2" />
      Resetar
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setIsEditing(true)}>
      <Pencil className="h-4 w-4 mr-2" />
      Renomear
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
      <Trash2 className="h-4 w-4 mr-2" />
      Excluir
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Ordem de Implementação

1. **PromptNode.tsx** - Implementar dropdown completo (modelo para os outros)
2. **MediaNode.tsx** - Replicar padrão
3. **SettingsNode.tsx** - Replicar padrão
4. **OutputNode.tsx** - Replicar padrão
5. **Editor.tsx** - Verificar/adicionar deleteKeyCode para edges

