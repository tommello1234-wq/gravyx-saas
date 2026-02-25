

## Redesign do Node de Resultado

### O que entendi do Figma

O novo design do OutputNode combina visualização de resultados com controles de geração em um único nó. Layout principal:

```text
┌──────────────────────────────┐  ┌──┐
│ ✦ Resultados    12 Imagens ⋮ │  │  │ ← thumbnails
├──────────────────────────────┤  │  │    verticais
│                              │  │  │    na lateral
│   Imagem principal grande    │  │  │    direita
│   (última gerada)            │  │  │
│                              │  │  │
├──────────────────────────────┤  │  │
│ Quantidade  [1] [2] [4]      │  │  │
│ Qualidade   [1K] [2K] [4K]  │  └──┘
│ Formato  [1:1][4:5][9:16][16:9] │
├──────────────────────────────┤
│  ▓▓ Gerar 4 Imagens  →  ▓▓  │
│     4 Créditos | 105 Disp.   │
└──────────────────────────────┘
```

Elementos-chave:
- **Imagem principal** grande ocupando a largura toda do nó (a imagem selecionada ou a mais recente)
- **Strip de thumbnails** vertical na lateral direita, fora do card principal, com scroll
- **Controles de Quantidade** (1, 2, 4) e **Qualidade** (1K, 2K, 4K) na mesma linha
- **Formato** (1:1, 4:5, 9:16, 16:9) com seletor pill-style, o selecionado com fundo verde
- **Botão "Gerar"** com gradiente verde (emerald) e seta, estilo largo
- **Info de créditos** abaixo do botão

### Mudanças

**`src/components/nodes/OutputNode.tsx`** — Reescrever layout

1. Adicionar estado para `selectedPreview` (imagem destacada no preview grande)
2. Adicionar estados de `aspectRatio`, `quantity` e `quality` (absorvendo funcionalidade do SettingsNode)
3. Layout principal: flex row com card principal + strip de thumbnails na direita
4. Card principal:
   - Header inalterado (ícone verde + label editável + menu)
   - Imagem principal grande com rounded corners
   - Linha de Quantidade (1, 2, 4) + Qualidade (1K, 2K, 4K) lado a lado
   - Linha de Formato (1:1, 4:5, 9:16, 16:9) com pill buttons, selecionado em verde
   - Botão "Gerar X Imagens →" com gradiente emerald
   - Texto de créditos abaixo
5. Strip lateral: coluna vertical de thumbnails pequenos, clicáveis para trocar o preview principal
6. Manter Handle de entrada à esquerda
7. Adicionar Handle de source à direita (para substituir o SettingsNode no fluxo)
8. Manter `nowheel`/`nodrag` + `stopPropagation` nos elementos interativos
9. Disparar `GENERATE_IMAGE_EVENT` no botão gerar (mesmo evento do SettingsNode)
10. Sincronizar `aspectRatio`, `quantity` no node data via `setNodes`

**`src/components/nodes/OutputNode.tsx`** — Dados do nó

- Expandir `OutputNodeData` para incluir `aspectRatio`, `quantity`, `quality`
- Importar `useAuth` para acessar créditos do perfil
- Importar `GENERATE_IMAGE_EVENT` e eventos de estado de geração do SettingsNode

**Nota**: O SettingsNode continua existindo para quem já tem fluxos com ele. O OutputNode passa a ser autossuficiente — pode gerar sem precisar de um SettingsNode conectado.

### Estilo visual (baseado no Figma)

- Borda do card: `border-emerald-500/30` (mantém)
- Thumbnails laterais: ~70px de largura, rounded, com borda sutil
- Botão gerar: gradiente emerald (`from-emerald-400 to-emerald-600`), texto escuro, rounded-full
- Pills de formato: fundo escuro, selecionado com fundo emerald
- Chips de quantidade/qualidade: compactos, inline

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/nodes/OutputNode.tsx` | Reescrever — novo layout com preview + thumbnails + controles integrados |

