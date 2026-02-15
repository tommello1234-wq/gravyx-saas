

## Criar aba "Inicio" como Home principal da plataforma

### Resumo

Criar uma nova rota `/home` e uma nova aba "Inicio" no header de navegacao, posicionada como primeiro item. Essa pagina sera a home principal apos login, com secoes estrategicas para aumentar retencao e incentivar criacao.

### Mudancas

#### 1. Nova pagina `src/pages/Home.tsx`

Pagina completa com as seguintes secoes:

**Hero Section**
- Saudacao dinamica baseada na hora do dia ("Bom dia", "Boa tarde", "Boa noite") + nome do usuario via `profile.display_name`
- Badge com plano atual e creditos restantes
- Botao principal "Criar novo projeto" (reutiliza logica do `CreateProjectModal`)

**Criacoes Recentes**
- Query nos `projects` do usuario, ordenados por `updated_at desc`, limit 6
- Cards com nome, data de ultima edicao e botao "Continuar" que navega para `/app?project={id}`
- Estado vazio com mensagem e botao "Criar primeiro projeto"

**Comecar com Template**
- Query nos `project_templates` filtrados por `allowed_tiers` do usuario, limit 6
- Cards com thumbnail, nome e botao "Usar template" (abre `CreateProjectModal` com template pre-selecionado)
- Botao "Ver todos os templates" (abre modal ou navega)

**Biblioteca em Destaque**
- Query nas `reference_images` via join com `reference_image_tags`, limit 6
- Para usuarios free: imagens sem tag `free` aparecem borradas com cadeado
- Botao "Explorar biblioteca" que navega para `/library`

**Estatisticas Rapidas**
- 4 cards pequenos:
  - Projetos criados (count de `projects`)
  - Imagens geradas (count de `generations` com status `completed`)
  - Creditos restantes (de `profile.credits`)
  - Plano atual (de `profile.tier`)

**Secao de Upgrade (condicional)**
- Visivel apenas para planos `free` e `starter`
- Card elegante com texto incentivando upgrade
- Botao "Ver planos" que abre `BuyCreditsModal`

#### 2. Atualizar `src/components/layout/Header.tsx`

- Adicionar item "Inicio" com icone `Home` como primeiro item no array `navItems`:
  ```
  { path: '/home', label: 'Inicio', icon: Home }
  ```

#### 3. Atualizar `src/App.tsx`

- Importar e adicionar rota `/home` protegida
- Mudar redirect da rota `/` de `/auth` para logica condicional (se autenticado vai pra `/home`, senao `/auth`) -- ou manter `/auth` e apos login redirecionar pra `/home`

#### 4. Atualizar redirecionamento pos-login

- No `src/pages/Auth.tsx` ou `ProtectedRoute`, garantir que apos login o usuario vai para `/home` em vez de `/projects`

### Detalhes tecnicos

- Todas as queries usam `@tanstack/react-query` seguindo o padrao existente
- Animacoes com `framer-motion` (fade-in, stagger nos cards)
- Componentes reutilizados: `Card`, `Button`, `Badge`, `BuyCreditsModal`, `CreateProjectModal`
- Layout segue o padrao existente: `Header` no topo + `container` com spacing
- Visual premium com `glass-card`, gradientes e icones `lucide-react`
- Responsivo: grid de 1 coluna no mobile, 2-3 colunas no desktop
- Saudacao dinamica calculada com `new Date().getHours()`

