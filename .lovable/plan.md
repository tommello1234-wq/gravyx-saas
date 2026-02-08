
# Plano: 6 Ajustes no Gravyx

## Visão Geral

Este plano aborda 6 melhorias solicitadas, incluindo ordenação de imagens, correção de scroll, gerenciamento de categorias, simplificação do menu, persistência do status de geração e remoção da landing page.

---

## 01 - Galeria: Ordenar por criação (mais recentes primeiro)

### Situação Atual
A galeria já possui `.order('created_at', { ascending: false })` na query, então as imagens mais recentes já vêm primeiro do banco. O layout masonry mantém essa ordem.

### Ação
Verificar se está funcionando corretamente. Se necessário, garantir que o render respeite a ordem da query sem modificar.

**Arquivo:** `src/pages/Gallery.tsx`
- A query já ordena corretamente (linha 59)
- Nenhuma alteração necessária se já funciona

---

## 02 - Output Node: Corrigir drag da barra de scroll

### Problema
Quando o usuário arrasta a barra de scroll (scrollbar track/thumb), o React Flow interpreta como drag do canvas, movendo a tela junto.

### Solução
Adicionar a classe `nodrag` junto com `nowheel` nos containers scrolláveis e aplicar `onMouseDown/onPointerDown` com `stopPropagation()` para impedir que o React Flow capture o evento de drag.

**Arquivo:** `src/components/nodes/OutputNode.tsx`
- Adicionar classes `nowheel nodrag` no container de content
- Adicionar `onPointerDown={(e) => e.stopPropagation()}` no ScrollArea

---

## 03 - Biblioteca Admin: Gerenciar categorias dinamicamente

### Problema Atual
As categorias são hardcoded como um enum no Supabase (`reference_category`). Não existe UI para criar, renomear ou excluir categorias.

### Solução
Criar uma nova tabela `reference_categories` no banco para armazenar categorias dinâmicas, com UI no Admin para gerenciá-las.

### Mudanças

**1. Migração SQL** - Nova tabela `reference_categories`
```sql
CREATE TABLE reference_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Migrar categorias existentes do enum
INSERT INTO reference_categories (slug, label) VALUES
  ('photography', 'Fotografia'),
  ('creative', 'Criativo'),
  ('food', 'Comida'),
  ('product', 'Produto'),
  ('portrait', 'Retrato'),
  ('landscape', 'Paisagem'),
  ('abstract', 'Abstrato');

-- Alterar coluna category para text
ALTER TABLE reference_images 
  ALTER COLUMN category TYPE text;
```

**2. Arquivo:** `src/pages/Admin.tsx`
- Adicionar aba ou seção "Gerenciar Categorias"
- CRUD de categorias: criar, renomear, excluir
- No upload de referência, buscar categorias da tabela ao invés de usar array hardcoded

**3. Atualizar:** `src/pages/Library.tsx`, `src/components/nodes/LibraryModal.tsx`
- Buscar categorias dinamicamente da tabela

---

## 04 - Dropdown do Header: Simplificar e adicionar edição de perfil

### Mudanças no Menu

**Remover:**
- Links "Meus Projetos" e "Galeria" (já estão na navegação principal)

**Manter:**
- Exibição de créditos
- Link Admin (se for admin)
- Botão Sair

**Adicionar:**
- Opção "Editar Perfil" com modal para:
  - Nome de exibição (display_name)
  - Foto de perfil (avatar_url)

### Arquivos

**1. Migração SQL** - Adicionar campos ao profiles
```sql
ALTER TABLE profiles 
  ADD COLUMN display_name text,
  ADD COLUMN avatar_url text;
```

**2. Arquivo:** `src/components/layout/Header.tsx`
- Remover links Projetos e Galeria do dropdown
- Adicionar "Editar Perfil" com ícone
- Criar componente `EditProfileModal`

**3. Novo arquivo:** `src/components/EditProfileModal.tsx`
- Form com campos: nome e upload de foto
- Salvar no profiles table
- Upload de imagem para bucket `avatars`

**4. Arquivo:** `src/contexts/AuthContext.tsx`
- Adicionar `display_name` e `avatar_url` ao tipo Profile
- Avatar no header usa foto do perfil se disponível

---

## 05 - Persistir status de geração entre navegação/reload

### Problema Atual
Os jobs pendentes são armazenados apenas no state local (`useState`). Quando o usuário navega para outra aba ou recarrega a página, o state é perdido e o botão não mostra mais "Gerando...".

### Solução
Ao carregar o Editor, verificar se existem jobs pendentes (status `queued` ou `processing`) no banco para aquele projeto e restaurar o estado do `pendingJobs`.

**Arquivo:** `src/hooks/useJobQueue.ts`
- Adicionar `useEffect` inicial que busca jobs com status `queued` ou `processing` do projeto
- Restaurar esses jobs no `pendingJobs` state

**Arquivo:** `src/pages/Editor.tsx`
- O hook já será atualizado, então o status será mantido automaticamente

---

## 06 - Remover Landing Page e redirecionar para Login

### Mudanças

**1. Arquivo:** `src/App.tsx`
- Alterar rota `/` para redirecionar para `/auth` (ou renderizar Auth diretamente)
- Manter página Index.tsx para possível uso futuro, mas não usar na rota principal

**2. Arquivo:** `src/pages/Auth.tsx`
- Remover link "Voltar" (não há mais landing page)
- Ajustar redirect after login para `/projects` (já está assim)

**3. Arquivo:** `src/components/layout/Header.tsx`
- Logo linka para `/projects` quando logado, `/auth` quando deslogado
- Verificar se o link de "Entrar" na header funciona corretamente

---

## Resumo de Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Gallery.tsx` | Verificar ordem (já está correta) |
| `src/components/nodes/OutputNode.tsx` | Adicionar `nodrag` e `onPointerDown` stopPropagation |
| `src/pages/Admin.tsx` | Adicionar gerenciamento de categorias |
| `src/pages/Library.tsx` | Buscar categorias dinamicamente |
| `src/components/nodes/LibraryModal.tsx` | Buscar categorias dinamicamente |
| `src/components/layout/Header.tsx` | Simplificar dropdown, adicionar editar perfil |
| `src/components/EditProfileModal.tsx` | **Novo** - Modal de edição de perfil |
| `src/contexts/AuthContext.tsx` | Adicionar display_name e avatar_url ao Profile |
| `src/hooks/useJobQueue.ts` | Restaurar jobs pendentes do banco ao carregar |
| `src/App.tsx` | Redirecionar `/` para `/auth` |
| `src/pages/Auth.tsx` | Remover link voltar |
| **Migrações SQL** | 2 novas migrações para categorias e campos de perfil |

---

## Ordem de Implementação

1. **Migrações SQL** - Criar tabelas/campos necessários
2. **Correção scroll OutputNode** - Solução rápida e isolada
3. **Remover landing page** - Alteração simples no roteamento
4. **Persistir status geração** - Melhorar hook de jobs
5. **Simplificar dropdown + editar perfil** - Header e modal
6. **Gerenciar categorias** - Admin e componentes relacionados
