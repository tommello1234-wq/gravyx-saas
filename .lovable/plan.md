

## Remover codigo de confirmacao do email de boas-vindas

### Problema
O email de boas-vindas mostra um codigo numerico de confirmacao (ex: "89246788") abaixo do botao "Confirmar Email". Esse codigo e desnecessario porque:
- Nao existe tela no app para digitar o codigo
- O botao "Confirmar Email" ja faz a confirmacao completa via link

### Solucao
Remover a secao do token de todos os templates de email que a exibem, ja que o fluxo do app usa apenas o link de confirmacao.

### Detalhes Tecnicos

**Arquivos a alterar:**

1. **`supabase/functions/send-auth-email/_templates/welcome.tsx`** - Remover o bloco condicional `{token && (...)}` que renderiza o separador, texto "Ou use este codigo" e o container com o codigo.

2. **`supabase/functions/send-auth-email/_templates/magic-link.tsx`** - Verificar e remover a mesma secao de token se existir.

3. **`supabase/functions/send-auth-email/_templates/password-reset.tsx`** - Verificar e remover a mesma secao de token se existir.

4. **`supabase/functions/send-auth-email/_templates/email-change.tsx`** - Verificar e remover a mesma secao de token se existir.

5. **`supabase/functions/send-auth-email/index.ts`** - Remover a passagem da prop `token` nos `React.createElement` de cada template, ja que nao sera mais usada.

6. **Deploy** da edge function `send-auth-email` apos as alteracoes.

Os emails ficarao apenas com o botao de acao (Confirmar Email, Redefinir Senha, etc.) seguido do disclaimer, sem a secao de codigo.

