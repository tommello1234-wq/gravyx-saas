
# Plano: Simplificação do Sistema de Créditos e Melhorias de UX

## Resumo das Mudanças

1. **Voltar para 1 crédito por imagem** (em vez de 10)
2. **Filtro por categoria na biblioteca** (LibraryModal)
3. **Loading no botão de gerar** (em vez de no OutputNode)
4. **Toolbar lateral para adicionar nodes** (estilo da referência)

---

## 1. Sistema de Créditos: 1 Crédito por Imagem

### Arquivos a modificar:

| Arquivo | Mudança |
|---------|---------|
| `src/components/nodes/SettingsNode.tsx` | Alterar `CREDITS_PER_IMAGE` de 10 para 1 |
| `supabase/functions/generate-image/index.ts` | Alterar `CREDITS_PER_IMAGE` de 10 para 1 |
| `src/components/BuyCreditsModal.tsx` | Atualizar labels para refletir imagens reais (500, 1200, 4000 imagens) |

---

## 2. Filtro por Categoria na Biblioteca

### Mudanças no `LibraryModal.tsx`:

- Adicionar estado `selectedCategory` para filtro ativo
- Exibir badges/chips clicáveis com todas as categorias
- Filtrar imagens por categoria selecionada + busca de texto
- Visual: chips horizontais acima da grid de imagens

```text
+------------------------------------------+
| [Todas] [Fotografia] [Criativo] [Comida] |
| [Produto] [Retrato] [Paisagem] [Abstrato]|
+------------------------------------------+
|  Grid de imagens filtradas               |
+------------------------------------------+
```

---

## 3. Loading no Botão de Gerar

### Mudanças necessárias:

**Editor.tsx:**
- Adicionar estado `isGenerating` global
- Disparar evento customizado com estado de loading para o SettingsNode

**SettingsNode.tsx:**
- Ouvir evento de loading
- Mostrar loading spinner + texto "Gerando..." no botão quando ativo
- Desabilitar botão durante geração

**OutputNode.tsx:**
- Remover o overlay de loading que cobre as imagens
- Manter grid de imagens sempre visível durante novas gerações

---

## 4. Toolbar Lateral para Adicionar Nodes

### Nova estrutura:

Criar barra vertical fixa no lado esquerdo do canvas com os ícones dos nodes.

**Novo componente: `src/components/editor/NodeToolbar.tsx`**

```text
+------+
|  T   |  <- Prompt (Type/Text)
+------+
|  🖼  |  <- Mídia (Image)
+------+
|  ⚙️  |  <- Configurações (Settings)
+------+
|  ✨  |  <- Resultado (Sparkles)
+------+
```

**Comportamento:**
- Ícones empilhados verticalmente
- Tooltip com nome do node ao passar o mouse
- Clique adiciona o node correspondente ao centro do canvas
- Estilo: fundo escuro, bordas arredondadas, similar à referência anexada

**Editor.tsx:**
- Remover o dropdown "Adicionar nó" do header
- Importar e renderizar NodeToolbar à esquerda do canvas (posição absoluta)

---

## Arquivos a Modificar

| Arquivo | Principais mudanças |
|---------|---------------------|
| `src/pages/Editor.tsx` | Estado `isGenerating`, remover dropdown, adicionar toolbar lateral, eventos de loading |
| `src/components/nodes/SettingsNode.tsx` | Loading no botão, 1 crédito/imagem, ouvir evento de loading |
| `src/components/nodes/OutputNode.tsx` | Remover overlay de loading, manter imagens visíveis |
| `src/components/nodes/LibraryModal.tsx` | Filtro por categoria com chips |
| `src/components/BuyCreditsModal.tsx` | Atualizar labels (500/1200/4000 imagens) |
| `supabase/functions/generate-image/index.ts` | Alterar para 1 crédito/imagem |

### Arquivo a Criar:
| Arquivo | Descrição |
|---------|-----------|
| `src/components/editor/NodeToolbar.tsx` | Barra de ferramentas lateral com ícones dos nodes |

---

## Layout Final do Editor

```text
+--------------------------------------------------+
|                    Header                        |
+------+-------------------------------------------+
|      |                                           |
|  T   |                                           |
|      |                                           |
| 🖼  |              Canvas                       |
|      |           (React Flow)                    |
|  ⚙️  |                                           |
|      |                                           |
|  ✨  |                                           |
|      |                                           |
+------+-------------------------------------------+
```

A toolbar fica posicionada absolutamente sobre o canvas, no lado esquerdo.
