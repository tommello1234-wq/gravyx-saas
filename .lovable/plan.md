

# Corrigir "Email nao encontrado" na recuperacao de senha

## Problema

A verificacao preventiva de email na pagina de recuperacao de senha faz uma query na tabela `profiles` para ver se o email existe. Porem, o usuario nao esta logado nesse momento, e a politica de RLS "Block anonymous access to profiles" bloqueia todas as consultas anonimas. Resultado: a query sempre retorna vazio, e o sistema mostra "Email nao encontrado" mesmo quando o email esta cadastrado.

## Solucao

Remover a verificacao preventiva de email do `ResetPassword.tsx`. O Supabase `resetPasswordForEmail` ja lida com isso internamente -- ele simplesmente envia o email se existir e nao faz nada se nao existir (por seguranca, para nao expor quais emails estao cadastrados). Isso tambem e uma pratica de seguranca melhor, pois evita enumeration attacks (um atacante descobrir quais emails estao cadastrados).

## Alteracao tecnica

### Arquivo: `src/pages/ResetPassword.tsx`

Simplificar a funcao `onRequestReset`:
- Remover a consulta a tabela `profiles` (linhas 57-69)
- Chamar diretamente `supabase.auth.resetPasswordForEmail`
- Mostrar a mensagem de "Email enviado" independentemente (o usuario nao precisa saber se o email existe ou nao -- padrao de seguranca)

