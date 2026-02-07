
# Plano: Botão de Créditos no Header + Auto-Save + Simplificar Modal

## Resumo das Mudanças

1. **Botão "Comprar créditos" ao lado do avatar** (fora do dropdown)
2. **Auto-save automático na galeria** (todas as imagens salvas automaticamente)
3. **Simplificar modal de imagem** (remover botão salvar e exibição do prompt)

---

## 1. Botão "Comprar créditos" no Header

### Arquivo: `src/components/layout/Header.tsx`

Adicionar um botão estilizado **antes** do avatar do usuário, fora do dropdown:

```text
+--------------------------------------------------+
| Logo     [Projetos] [Galeria] [Biblioteca]       |
|                        [Comprar créditos] [Avatar]
+--------------------------------------------------+
```

**Mudanças:**
- Mover o botão "Comprar créditos" para fora do `DropdownMenuContent`
- Posicionar ao lado do avatar (à esquerda)
- Estilo similar à referência: botão com ícone + texto, borda primary

---

## 2. Auto-Save Automático na Galeria

### Arquivo: `supabase/functions/generate-image/index.ts`

Adicionar `saved_to_gallery: true` nos inserts da tabela `generations`:

```typescript
const generationInserts = successfulImages.map(imageUrl => ({
  user_id: user.id,
  project_id: projectId,
  prompt: prompt,
  aspect_ratio: aspectRatio || '1:1',
  image_url: imageUrl,
  status: 'completed',
  saved_to_gallery: true  // <-- Adicionar
}));
```

### Arquivo: `src/components/nodes/OutputNode.tsx`

- Remover a função `handleSaveToGallery`
- Remover a prop `onSaveToGallery` do modal
- Remover o indicador de "salvo" (checkmark verde) das imagens
- Simplificar para que todas as imagens já sejam consideradas salvas

---

## 3. Simplificar Modal de Imagem

### Arquivo: `src/components/nodes/OutputImageModal.tsx`

**Remover:**
- Toda a seção do prompt (linhas 101-118)
- Botão "Salvar na Galeria" (linhas 122-136)
- Props `onSaveToGallery` e estado `isSaving`
- Função `handleSaveToGallery`
- Função `handleCopyPrompt`
- Metadado de proporção (manter apenas data de geração)

**Manter apenas:**
- Visualização da imagem
- Botão "Baixar"
- Botão "Excluir"
- Data de geração

**Layout final do modal:**
```text
+----------------------------------+
|  Visualizar Imagem           [X] |
+----------------------------------+
|                                  |
|         [IMAGEM]                 |
|                                  |
+----------------------------------+
|   [Baixar]        [Excluir]      |
+----------------------------------+
|   Gerado em: 07/02/2026, 10:30   |
+----------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/layout/Header.tsx` | Botão "Comprar créditos" fora do dropdown, ao lado do avatar |
| `supabase/functions/generate-image/index.ts` | Adicionar `saved_to_gallery: true` |
| `src/components/nodes/OutputNode.tsx` | Remover lógica de salvar manualmente, remover indicador de salvo |
| `src/components/nodes/OutputImageModal.tsx` | Remover prompt, remover botão salvar, simplificar interface |

---

## Detalhes Técnicos

### Interface Simplificada do OutputImageModal

```typescript
interface OutputImageModalProps {
  image: NodeImage | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (image: NodeImage) => void;
  // Removido: onSaveToGallery
}
```

### Novo Layout do Header (área direita)

```typescript
<div className="flex items-center gap-3">
  {/* Botão Comprar Créditos */}
  <Button
    variant="outline"
    className="rounded-full border-primary/50 hover:bg-primary/10"
    onClick={() => setShowBuyCredits(true)}
  >
    <CreditCard className="mr-2 h-4 w-4" />
    Comprar créditos
  </Button>
  
  {/* Avatar com Dropdown */}
  <DropdownMenu>
    ...
  </DropdownMenu>
</div>
```
