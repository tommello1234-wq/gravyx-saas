# Plano: Simplificação do Sistema de Créditos e Melhorias de UX

## ✅ CONCLUÍDO

### 1. Sistema de Créditos: 1 Crédito por Imagem
- [x] `CREDITS_PER_IMAGE = 1` em SettingsNode.tsx e generate-image/index.ts
- [x] Labels atualizados em BuyCreditsModal.tsx (500, 1.200, 4.000 imagens)

### 2. Filtro por Categoria na Biblioteca
- [x] Chips clicáveis para filtrar por categoria no LibraryModal
- [x] Filtro combinado com busca de texto

### 3. Loading no Botão de Gerar
- [x] Evento `GENERATING_STATE_EVENT` criado
- [x] Loading spinner aparece no botão do SettingsNode
- [x] Overlay de loading removido do OutputNode
- [x] Imagens permanecem visíveis durante nova geração

### 4. Toolbar Lateral para Adicionar Nodes
- [x] Novo componente `NodeToolbar.tsx` criado
- [x] Ícones com tooltips ao passar o mouse
- [x] Dropdown removido do header
- [x] Toolbar posicionada à esquerda do canvas

---

## Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/Editor.tsx` | Importa NodeToolbar, remove dropdown, eventos de loading |
| `src/components/nodes/SettingsNode.tsx` | 1 crédito/imagem, loading no botão |
| `src/components/nodes/OutputNode.tsx` | Remove overlay de loading |
| `src/components/nodes/LibraryModal.tsx` | Filtro por categoria |
| `src/components/BuyCreditsModal.tsx` | Labels 500/1.200/4.000 imagens |
| `supabase/functions/generate-image/index.ts` | 1 crédito/imagem |

### Arquivo Criado
| `src/components/editor/NodeToolbar.tsx` | Toolbar lateral com ícones dos nodes |
