
# Plano: Renomear Nodes, Reset e Copy/Paste com Conexões

## Visão Geral

Este plano implementa três funcionalidades nos nodes do editor:

1. **Renomear nodes** - Ícone de lápis para editar o nome/label do node
2. **Resetar node** - Ícone para limpar conteúdo e remover conexões
3. **Copy/Paste nativo** - Ctrl+C/Ctrl+V copia o node exatamente como está (com dados e conexões)
04. Agora quero que permita adicionar mais de um node de configuração e mais de um node de galeria, caso um agindo de forma individual, pra caso o usuario queria criar vários varias coisas no mesmo arquivo.

Os ícones de **duplicar** e **apagar** serão removidos, já que os atalhos Delete e Ctrl+C/V farão essas funções.

---

## Mudanças por Arquivo

### 1. Nodes Individuais (PromptNode, MediaNode, SettingsNode, OutputNode)

**Remover:**
- Botões de Copy (duplicar) e Trash (apagar)
- Funções `handleDuplicate` e `handleDelete`

**Adicionar:**
- Ícone de **lápis** (Pencil) - abre input inline para editar o label
- Ícone de **reset** (RotateCcw) - reseta o node ao estado padrão

**Comportamento do Reset por tipo:**
| Tipo | Estado após reset |
|------|------------------|
| Prompt | `value: ''` (texto vazio) |
| Media | `url: null, libraryPrompt: null` (sem imagem) |
| Settings | `aspectRatio: '1:1', quantity: 1` (padrões) |
| Output | `images: []` (sem imagens) |

O reset também remove todas as conexões (edges) do node.

**UI do Rename:**
- Input inline que aparece no lugar do título ao clicar no lápis
- Enter ou blur confirma, Escape cancela
- Salva no `data.label` do node

---

### 2. Editor.tsx - Copy/Paste com Conexões

**Adicionar:**
- Hook `useKeyPress` ou listener de teclado para Ctrl+C e Ctrl+V
- Ref para armazenar nodes/edges copiados

**Comportamento do Copy (Ctrl+C):**
1. Pega todos os nodes selecionados (`selected: true`)
2. Pega todas as edges que conectam os nodes selecionados entre si
3. Armazena em um ref (não no clipboard real, para manter dados complexos)

**Comportamento do Paste (Ctrl+V):**
1. Cria novos nodes com IDs únicos (`${type}-${Date.now()}-${index}`)
2. Mantém todos os dados (`value`, `url`, `images`, etc.)
3. Recria edges com os novos IDs (mapeando source/target)
4. Posiciona com offset de +50px em X e Y
5. Adiciona ao canvas

**Delete (tecla Delete):**
- React Flow já suporta isso nativamente quando `deleteKeyCode` não é desabilitado
- Verificar se está funcionando; se não, adicionar listener

---

## Estrutura do Código

### Header do Node (exemplo com PromptNode):

```text
┌─────────────────────────────────────────┐
│ [Icon]  Prompt (editável)    [🔄] [✏️] │
│         Descreva sua imagem             │
└─────────────────────────────────────────┘
```

- Clicando no ✏️ (lápis): título vira input editável
- Clicando no 🔄 (reset): limpa o conteúdo do node

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/nodes/PromptNode.tsx` | Remover duplicate/delete, adicionar rename/reset |
| `src/components/nodes/MediaNode.tsx` | Remover duplicate/delete, adicionar rename/reset |
| `src/components/nodes/SettingsNode.tsx` | Remover duplicate/delete, adicionar rename/reset |
| `src/components/nodes/OutputNode.tsx` | Remover duplicate/delete, adicionar rename/reset |
| `src/pages/Editor.tsx` | Adicionar copy/paste com edges, verificar delete nativo |

---

## Detalhes Técnicos

### Copy/Paste no Editor.tsx

```text
// Refs para clipboard interno
const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

// Listener de teclado
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignorar se estiver digitando em input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c') {
        // Copy: pegar nodes selecionados e edges entre eles
      }
      if (e.key === 'v') {
        // Paste: criar novos nodes/edges com IDs únicos
      }
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [nodes, edges]);
```

### Reset no Node

```text
const handleReset = useCallback(() => {
  // 1. Resetar dados do node
  setNodes(nodes => nodes.map(n => 
    n.id === id ? { ...n, data: { ...n.data, value: '' } } : n
  ));
  
  // 2. Remover todas as conexões do node
  setEdges(edges => edges.filter(e => e.source !== id && e.target !== id));
}, [id, setNodes, setEdges]);
```

Para o reset funcionar, os nodes precisarão receber `setEdges` via contexto ou prop. A solução mais limpa é usar `useReactFlow().setEdges()`.

---

## Ordem de Implementação

1. **Editor.tsx** - Adicionar sistema de copy/paste com edges
2. **PromptNode.tsx** - Refatorar header (remove buttons, add rename/reset)
3. **MediaNode.tsx** - Mesma refatoração
4. **SettingsNode.tsx** - Mesma refatoração
5. **OutputNode.tsx** - Mesma refatoração
