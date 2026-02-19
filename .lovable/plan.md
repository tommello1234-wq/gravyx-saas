

## Auto-criar conta quando Ticto recebe pagamento de email nao cadastrado

### Resumo

Quando o webhook da Ticto receber um pagamento (ou trial) de um email que nao existe na plataforma, o sistema vai automaticamente:
1. Criar o usuario no Supabase Auth com uma senha padrao
2. Aguardar o trigger `handle_new_user` criar o profile
3. Atualizar o profile com o plano/creditos corretos
4. Enviar um email de boas-vindas customizado com a senha padrao e o link de login

### O que muda

**1. Edge Function `ticto-webhook/index.ts`**
- Criar uma funcao helper `createAccountAndProfile()` que:
  - Gera uma senha padrao segura (ex: `Gravyx@2025!` ou algo memoravel)
  - Usa `supabase.auth.admin.createUser()` com `email_confirm: true` (pula confirmacao, ja que pagou)
  - Aguarda o trigger criar o profile (pequeno delay + retry)
  - Retorna o `user_id` criado
- Nos pontos onde hoje retorna "User not found" (trial e aprovacao), em vez de ignorar:
  - Chamar `createAccountAndProfile()`
  - Continuar o fluxo normalmente com o profile recem-criado
- Enviar email de boas-vindas com credenciais via Resend diretamente do webhook

**2. Novo template de email `_templates/welcome-credentials.tsx`**
- Email no estilo visual do Gravyx (usando o BaseLayout existente)
- Conteudo:
  - "Sua conta foi criada com sucesso!"
  - Email de acesso
  - Senha padrao (em destaque)
  - Aviso que e uma senha padrao e recomendacao de trocar
  - Botao "Acessar o Gravyx" apontando para `https://app.gravyx.com.br`

**3. Sem mudancas no banco de dados**
- O trigger `handle_new_user` ja cria o profile automaticamente quando um usuario e criado no Auth
- Nenhuma migration necessaria

### Detalhes Tecnicos

**Fluxo de criacao automatica:**

```text
Ticto Webhook recebido
       |
  Email existe no profiles?
      / \
    Sim   Nao
     |      |
  Continua  Cria usuario via admin.createUser()
  normal      |
            Trigger handle_new_user cria profile
              |
            Atualiza profile (tier, credits, etc)
              |
            Envia email com senha padrao via Resend
              |
            Continua fluxo normal
```

**Senha padrao:** `Gravyx@2025!` - fixa para simplificar. O email instruira o usuario a trocar.

**`supabase.auth.admin.createUser()`** - disponivel com service_role_key, permite:
- Definir senha
- Marcar email como confirmado (`email_confirm: true`)
- Pular o fluxo de confirmacao por email

**Email de credenciais:** Enviado diretamente via Resend (mesma API key ja configurada), sem passar pelo hook de auth do Supabase. Isso porque o hook de auth so dispara em eventos como signup/recovery, e aqui estamos criando o usuario via admin API.

### Arquivos alterados

1. `supabase/functions/ticto-webhook/index.ts` - adicionar logica de auto-criacao
2. `supabase/functions/send-auth-email/_templates/welcome-credentials.tsx` - novo template de email (arquivo novo)

### Seguranca

- A senha padrao e a mesma para todos, entao o email deixa claro que deve ser trocada
- O `email_confirm: true` e seguro aqui pois o usuario ja validou identidade ao pagar com cartao
- O service_role_key ja esta disponivel na edge function

