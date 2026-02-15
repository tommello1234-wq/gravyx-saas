
## Transformar biblioteca em sistema de tags (multi-categoria)

### Problema atual
Cada imagem tem **uma** categoria (`category` text). Usuários free veem apenas as 3 primeiras imagens por ordem cronológica, independente da categoria.

### Nova lógica
- Imagens podem ter **múltiplas tags** (ex: "Fotografia" + "Grátis")
- Usuários free: veem normalmente apenas imagens com a tag **"Grátis"** (slug `free`). Ao clicar em outra aba, as imagens sem tag `free` aparecem borradas com cadeado
- Usuários pagos: veem tudo normalmente, sem restrição

### Mudanças no banco de dados

1. **Nova tabela `reference_image_tags`** (relação muitos-para-muitos):

```text
reference_image_tags
  - id (uuid, PK)
  - image_id (uuid, FK -> reference_images.id, ON DELETE CASCADE)
  - category_id (uuid, FK -> reference_categories.id, ON DELETE CASCADE)
  - UNIQUE(image_id, category_id)
```

2. **Migrar dados existentes**: Inserir na nova tabela os relacionamentos baseados no campo `category` atual de cada imagem
3. **RLS**: Permitir leitura para todos (`authenticated`), escrita apenas para admins

### Mudanças no frontend

**`src/pages/Library.tsx`**:
- Buscar imagens via `reference_image_tags` com join, em vez de filtrar por `category` direto
- Lógica de "locked": em vez de `index >= libraryLimit`, verificar se a imagem **não tem** a tag `free` e o usuário é do plano free
- Filtro por categoria: mostrar imagens que possuem a tag da categoria selecionada

**`src/components/nodes/LibraryModal.tsx`**:
- Mesma lógica: buscar via join com `reference_image_tags`
- Lock baseado em tag `free` em vez de índice

**`src/lib/plan-limits.ts`**:
- Remover `libraryLimit` da configuração (não é mais necessário, a lógica agora é por tag)

**Admin - Modal de adicionar imagem à biblioteca** (onde o admin escolhe a categoria):
- Permitir selecionar **múltiplas categorias/tags** ao adicionar uma imagem, incluindo a tag "Grátis"
- Ao salvar, inserir uma linha em `reference_image_tags` para cada tag selecionada

### Detalhes técnicos

A query principal muda de:
```sql
SELECT * FROM reference_images WHERE category = 'photography'
```
Para:
```sql
SELECT ri.*, array_agg(rc.slug) as tags
FROM reference_images ri
JOIN reference_image_tags rit ON ri.id = rit.image_id
JOIN reference_categories rc ON rit.category_id = rc.id
GROUP BY ri.id
```

No frontend, o filtro por categoria:
```typescript
// Filtrar imagens que possuem a tag selecionada
const filtered = images.filter(img => img.tags.includes(selectedCategory));

// Lógica de bloqueio
const isLocked = tier === 'free' && !img.tags.includes('free');
```

O campo `reference_images.category` antigo pode ser mantido temporariamente para compatibilidade e removido depois.
