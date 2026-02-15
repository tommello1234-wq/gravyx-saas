

## Sistema de Contribuicoes da Comunidade para a Biblioteca

### Resumo

Permitir que usuarios com plano ativo enviem imagens para a biblioteca. As submissoes passam por aprovacao do admin. Ao aprovar, o usuario ganha 2 creditos. A imagem aparece na biblioteca com atribuicao ao autor.

### Mudancas

#### 1. Banco de dados (migracao SQL)

**Nova tabela `community_submissions`**

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | ID da submissao |
| user_id | uuid NOT NULL | Quem enviou |
| title | text NOT NULL | Titulo da imagem |
| prompt | text NOT NULL | Prompt usado |
| image_url | text NOT NULL | URL no storage |
| status | text default 'pending' | pending, approved, rejected |
| admin_note | text nullable | Motivo de rejeicao |
| created_at | timestamptz | Data de envio |
| reviewed_at | timestamptz nullable | Data da revisao |
| reviewed_by | uuid nullable | Admin que revisou |

**Nova coluna em `reference_images`**

- `submitted_by` (uuid, nullable) -- para creditar o autor

**RLS em `community_submissions`**

- Usuarios autenticados: INSERT e SELECT apenas nos proprios registros
- Admins: SELECT e UPDATE em todos

**Storage policy**

- Adicionar policy para usuarios autenticados fazerem upload no bucket `reference-images` na pasta `submissions/{user_id}/`

#### 2. Novo componente `src/components/SubmitToLibraryModal.tsx`

Modal com:

- Informativo no topo: "Envie imagens geradas por voce aqui no GravyX, ou materiais que o GravyX te ajudou a criar: criativos, flyers, banners..."
- Campo: Titulo
- Campo: Prompt utilizado
- Selecao de categoria (mesma lista de categorias existentes, excluindo "free")
- Upload de imagem (para `reference-images/submissions/{user_id}/{timestamp}.ext`)
- Botao "Enviar para revisao"
- Mensagem de sucesso: "Sua imagem foi enviada! Voce ganhara 2 creditos quando for aprovada."

Validacao: titulo, prompt e imagem sao obrigatorios. Apenas usuarios com plano diferente de `free` podem enviar.

#### 3. Atualizar `src/pages/Library.tsx`

- Adicionar botao "Contribuir com a biblioteca" ao lado do titulo/descricao
- Icone de presente ou estrela
- Subtexto: "Envie e ganhe creditos gratis!"
- Visivel para todos, mas ao clicar:
  - Se free: abre o modal de upgrade
  - Se plano pago: abre o `SubmitToLibraryModal`

#### 4. Atualizar `src/pages/Admin.tsx` - Aba Biblioteca

Adicionar secao "Submissoes da Comunidade" na aba biblioteca do admin:

- Lista de submissoes pendentes com: preview da imagem, titulo, prompt, nome/email do usuario
- Botao "Aprovar": abre mini-dialog para selecionar tags, depois:
  1. Cria registro em `reference_images` com `submitted_by = submission.user_id`
  2. Insere tags em `reference_image_tags`
  3. Incrementa +2 creditos no perfil do usuario (via update direto na tabela profiles, somando ao saldo atual)
  4. Atualiza status da submission para `approved`
- Botao "Rejeitar": atualiza status para `rejected`, opcionalmente com nota

#### 5. Atualizar `src/components/ImageViewerModal.tsx`

- Aceitar campo opcional `submittedBy` com nome e avatar
- Exibir "Contribuicao de [Nome]" + avatar quando a imagem tiver autor
- A query na Library precisa buscar o `submitted_by` e fazer join com `profiles` para pegar `display_name` e `avatar_url`

### Detalhes tecnicos

- Upload usa o bucket `reference-images` existente (publico), pasta `submissions/`
- Creditos sao somados via `UPDATE profiles SET credits = credits + 2 WHERE user_id = X` (admin ja tem policy de update)
- Todas as queries usam `@tanstack/react-query`
- O modal de submissao segue o mesmo padrao visual do `CreateProjectModal`
- Animacoes com `framer-motion`
- Icones com `lucide-react`

