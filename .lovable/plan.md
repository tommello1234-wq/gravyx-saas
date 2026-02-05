
# Plano de Implementação: Avion - Gerador de Imagens IA

## Resumo
Construir um gerador de imagens IA baseado em nós (node-based) com interface SaaS moderna, sistema de autenticação, canvas visual com React Flow, e integração com Supabase para backend.

---

## Fase 1: Setup do Banco de Dados

### Tabelas a Criar

**1. Enum de Roles**
- `app_role`: admin, user

**2. Enum de Categorias**
- `reference_category`: photography, creative, food, product, portrait, landscape, abstract

**3. Tabela `profiles`**
- user_id (FK auth.users), email, credits (default 5), tier (free/pro), created_at, updated_at
- Trigger automático para criar profile no signup

**4. Tabela `user_roles`**
- user_id, role (app_role)
- Function RPC: has_role(user_id, role)

**5. Tabela `projects`**
- id, user_id, name, canvas_state (JSONB), created_at, updated_at

**6. Tabela `generations`**
- id, user_id, project_id (FK), prompt, image_url, aspect_ratio, status, created_at

**7. Tabela `reference_images`**
- id, title, prompt, category, image_url, created_by, created_at

**8. Tabela `project_templates`**
- id, name, description, canvas_state, thumbnail_url, created_by, created_at

**9. Tabela `credit_packages`**
- id, name, credits, price_brl, product_id, created_at

**10. Tabela `webhook_logs`**
- id, event_type, payload, processed, error_message, created_at

### Storage Buckets
- `reference-images`: público, para imagens de referência
- `user-media`: público por URL, organizado por user_id

### RLS Policies
- profiles: usuários acessam apenas próprio perfil
- projects: usuários acessam apenas próprios projetos
- generations: usuários acessam apenas próprias gerações
- reference_images: leitura pública, escrita admins
- project_templates: leitura pública, escrita admins

---

## Fase 2: Design System (Tema Dark Cyberpunk)

### Cores CSS
- Background: HSL 240 10% 4% (quase preto com tom azulado)
- Gradiente principal: #A78BFA -> #8B5CF6 -> #6366F1
- Cards: glassmorphism com backdrop-blur-xl
- Bordas: white/10 semi-transparentes

### Componentes Visuais
- Grid pattern animado no background
- Glow effects em botões e elementos
- Orbs animados de gradiente

---

## Fase 3: Estrutura de Rotas e Layouts

### Rotas
- `/` - Landing Page
- `/auth` - Login/Cadastro
- `/reset-password` - Recuperação de senha
- `/projects` - Lista de projetos (protegida)
- `/app` - Canvas Editor (protegida, ?project=id)
- `/gallery` - Galeria de gerações (protegida)
- `/library` - Biblioteca de referências (protegida)
- `/admin` - Painel administrativo (protegida, role admin)

### Componentes de Layout
- Header: Logo, navegação pill toggle, créditos, menu usuário
- AuthProvider: contexto de autenticação
- ProtectedRoute: wrapper para rotas autenticadas

---

## Fase 4: Sistema de Autenticação

### Páginas
- Login/Signup com toggle
- Validação Zod (email válido, senha mín. 6 chars)
- Link "Esqueceu a senha?"
- Reset password com detecção de token na URL

### Edge Functions
- `send-auth-email`: emails de welcome e recovery via Resend

---

## Fase 5: Landing Page

### Seções
- Hero com título, subtítulo, badge "Alimentado por IA"
- Estatísticas animadas
- "Como Funciona" com 3 cards
- CTA final
- Footer

---

## Fase 6: Sistema de Projetos

### Componentes
- Grid de cards de projetos
- Modal de criação com nome + template
- CRUD completo de projetos
- Auto-save com debounce

---

## Fase 7: Canvas Editor (Core)

### Dependências
- @xyflow/react (React Flow)
- Framer Motion

### 4 Tipos de Nós

**PromptNode (Cyan)**
- Textarea, handle saída direita
- Rename, duplicate, delete

**MediaNode (Cyan)**
- Upload/seleção biblioteca
- Preview, handle saída

**SettingsNode (Purple)**
- Aspect ratio: 1:1, 4:5, 9:16, 16:9
- Quantidade: 1, 2, 4
- Botão "Gerar", handles entrada/saída

**OutputNode (Pink)**
- Grid de imagens
- Loader, lightbox, download
- Handle entrada

### Features
- MiniMap, Controls
- Keyboard shortcuts
- Auto-save para Supabase + localStorage draft

---

## Fase 8: Edge Function de Geração

### `generate-image`
- Autenticação obrigatória
- Validação de créditos
- Chamada Lovable AI Gateway (gemini-3-pro-image-preview)
- Suporte a referências
- Salvamento em `generations`
- Reembolso em caso de erro

---

## Fase 9: Galeria e Biblioteca

### Galeria (/gallery)
- Grid de gerações do usuário
- Filtros, hover info, lightbox

### Biblioteca (/library)
- Referências públicas
- Filtro por categoria
- Copiar prompt

---

## Fase 10: Sistema de Créditos e Admin

### UpgradeModal
- 3 pacotes com links Ticto

### Webhook Ticto
- Edge function para processar pagamentos

### Painel Admin
- Tabs: Referências, Templates, Usuários
- CRUD de referências e templates
- Gerenciamento de créditos de usuários

---

## Detalhes Técnicos

### Estrutura de Pastas
```text
src/
  components/
    layout/
      Header.tsx
      Footer.tsx
    nodes/
      PromptNode.tsx
      MediaNode.tsx
      SettingsNode.tsx
      OutputNode.tsx
    modals/
      UpgradeModal.tsx
      CreateProjectModal.tsx
    ui/
      (shadcn components)
  contexts/
    AuthContext.tsx
  hooks/
    useAuth.ts
    useCredits.ts
    useProjects.ts
  pages/
    Index.tsx (Landing)
    Auth.tsx
    ResetPassword.tsx
    Projects.tsx
    Editor.tsx
    Gallery.tsx
    Library.tsx
    Admin.tsx
  lib/
    utils.ts
supabase/
  functions/
    generate-image/
    send-auth-email/
    ticto-webhook/
```

### Dependências a Instalar
- @xyflow/react
- framer-motion
- resend (edge function)
