

## Corrigir erro "insertBefore" no DOM (Windows/Extensoes de navegador)

### Diagnostico

O erro **"Falha ao executar 'insertBefore' em 'Node'"** e um problema classico do React causado por **extensoes de navegador** (Google Translate, Grammarly, ad blockers, etc.) que modificam o DOM diretamente. Quando o React tenta reconciliar seu Virtual DOM com o DOM real que foi alterado externamente, ele nao encontra os nos esperados e lanca esse erro.

Isso explica por que acontece apenas no Windows do usuario (provavelmente tem extensoes ativas naquele navegador).

### Solucao

Duas frentes de correcao:

**1. Prevenir a interferencia externa no DOM**
- Adicionar `translate="no"` e `class="notranslate"` no elemento `<html>` do `index.html` para impedir que o Google Translate modifique o DOM
- Adicionar meta tag `<meta name="google" content="notranslate" />`

**2. Tornar o ErrorBoundary resiliente a esse erro especifico**
- Detectar quando o erro e do tipo "insertBefore"/"removeChild" (erros de manipulacao DOM externa)
- Ao inves de mostrar a tela de erro, fazer auto-recovery automatico (re-render silencioso)
- Limitar tentativas automaticas (max 3) para evitar loop infinito
- Se exceder o limite, ai sim mostrar a tela de erro normalmente

### Detalhes tecnicos

**`index.html`**: Adicionar atributos anti-traducao no `<html>` e meta tag google notranslate.

**`src/components/ErrorBoundary.tsx`**:
- Adicionar contador de retries no state
- No `getDerivedStateFromError`, verificar se a mensagem contem "insertBefore", "removeChild", ou "not a child"
- Se for erro de DOM externo e retries < 3: retornar `{ hasError: false, retries: retries + 1 }` (auto-recovery)
- Se exceder limite ou for outro tipo de erro: mostrar a UI de erro atual

