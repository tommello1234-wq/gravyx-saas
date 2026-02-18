

## Seletor de Idioma na Plataforma (PT / EN / ES)

### Escopo

A plataforma inteira tem textos hardcoded em portugues em dezenas de componentes (Header, Auth, Home, Projects, Gallery, Library, Editor, modals, nodes, admin, etc). Implementar i18n completo envolve:

1. Criar um sistema de traducoes (Context + arquivos de traducao)
2. Adicionar o seletor de bandeira no Header
3. Traduzir todos os textos de todos os componentes

### Abordagem

Usar um **LanguageContext** proprio (sem bibliotecas externas como react-i18next) com arquivos JSON de traducao organizados por idioma. O idioma escolhido sera salvo no `localStorage` para persistir entre sessoes.

### Estrutura de Arquivos

```text
src/
  contexts/
    LanguageContext.tsx        -- Context + hook useLanguage()
  i18n/
    pt.ts                     -- Traducoes em portugues
    en.ts                     -- Traducoes em ingles
    es.ts                     -- Traducoes em espanhol
    index.ts                  -- Tipo + mapa de idiomas
```

### Detalhes Tecnicos

#### 1. LanguageContext

- Armazena o idioma atual (`pt`, `en`, `es`)
- Funcao `t(key)` que busca a traducao pela chave
- Funcao `setLanguage(lang)` para trocar o idioma
- Persiste no `localStorage` com fallback para `pt`
- Detecta idioma do navegador como fallback inicial (`navigator.language`)

#### 2. Arquivos de Traducao

Organizados por secao, exemplo:

```text
header.home = "Inicio" / "Home" / "Inicio"
header.projects = "Projetos" / "Projects" / "Proyectos"
auth.welcome_back = "Bem-vindo de volta" / "Welcome back" / "Bienvenido de nuevo"
home.greeting_morning = "Bom dia" / "Good morning" / "Buenos dias"
...
```

Aproximadamente 150-200 chaves de traducao cobrindo:
- Header (nav items, menu do usuario)
- Auth (login, cadastro, reset password)
- Home (saudacoes, banners, secoes)
- Projects (titulos, acoes, modals)
- Gallery (titulos, acoes, confirmacoes)
- Library (titulos, filtros)
- Editor (nodes, toolbars, popups)
- Modals (BuyCredits, CreateProject, EditProfile, etc)
- Footer
- Admin (parcial - so textos visiveis)
- Mensagens de toast/erro

#### 3. Seletor de Idioma no Header

- Icone de globo (Globe do Lucide) posicionado a esquerda do botao "Comprar creditos"
- Dropdown com 3 opcoes, cada uma com emoji de bandeira:
  - Portugues (BR)
  - English (US)
  - Espanol (ES)
- Ao selecionar, troca o idioma instantaneamente

#### 4. Integracao nos Componentes

Cada componente que tem texto hardcoded sera atualizado para usar `const { t } = useLanguage()` e substituir strings por `t('chave')`.

Tambem sera necessario ajustar o locale do `date-fns` dinamicamente (ptBR, enUS, es) conforme o idioma selecionado.

### Volume de Alteracoes

- **Novos arquivos**: 5 (context + 3 traducoes + index)
- **Arquivos modificados**: ~25-30 componentes
- **Maior risco**: garantir que nenhum texto ficou sem traduzir

### Limitacoes

- Emails de autenticacao (send-auth-email) continuarao em portugues pois sao templates server-side separados
- Conteudo dinamico do banco (nomes de projetos, prompts) nao sera traduzido
- Textos do admin serao traduzidos parcialmente (foco nas telas que usuarios normais nao veem)

