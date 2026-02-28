

## Plano: Botão de lixeira nas edges (linhas de conexão)

### O que muda
Quando o usuário seleciona/clica numa edge, aparece um ícone de lixeira pequeno no meio da linha. Ao clicar no ícone, a edge é removida.

### Alterações

**1. Criar `src/components/edges/DeletableEdge.tsx`**
- Componente custom edge usando `BaseEdge`, `EdgeLabelRenderer` e `getBezierPath` do `@xyflow/react`
- Renderiza a linha normalmente (bezier)
- Quando `selected === true`, mostra um botão pequeno (24x24) com ícone `Trash2` centralizado no ponto médio da edge
- O botão chama `setEdges` para remover a edge pelo `id`
- Estilo: fundo `bg-destructive`, ícone branco, `rounded-full`, com sombra sutil

**2. Atualizar `src/pages/Editor.tsx`**
- Importar `DeletableEdge`
- Criar `edgeTypes = { default: DeletableEdge }` (memoizado)
- Passar `edgeTypes={edgeTypes}` ao `<ReactFlow>`

**3. Atualizar `src/pages/TemplateEditor.tsx`**
- Mesma configuração de `edgeTypes` para consistência

