
# Configuração de Emails Transacionais com Resend

Vou criar uma Edge Function completa para enviar emails estilizados no tema dark cyberpunk do Avion.

## O que será criado

### 1. Edge Function `send-auth-email`
Uma função que recebe webhooks do Supabase Auth e envia emails personalizados via Resend.

### 2. Templates React Email

| Tipo | Quando é enviado |
|------|------------------|
| **Welcome** | Ao criar nova conta (confirmação de email) |
| **Magic Link** | Login sem senha |
| **Password Reset** | Recuperação de senha |
| **Email Change** | Mudança de email |

### 3. Design dos Emails

Cada template terá:
- **Header**: Logo Avion com gradiente violet/purple
- **Corpo**: Fundo dark (#0a0a0f) com cards glass effect
- **Botão CTA**: Gradiente primary com glow effect
- **Footer**: Links e copyright

```text
┌─────────────────────────────────┐
│      ✨ Avion                   │  ← Logo com gradiente
├─────────────────────────────────┤
│                                 │
│   Bem-vindo ao Avion!           │  ← Título gradient-text
│                                 │
│   ┌───────────────────────┐     │
│   │                       │     │
│   │   Confirme seu email  │     │  ← Card glass
│   │   para começar a      │     │
│   │   criar imagens       │     │
│   │                       │     │
│   │  [ Confirmar Email ]  │     │  ← Botão com glow
│   │                       │     │
│   └───────────────────────┘     │
│                                 │
│   Se você não criou esta conta, │
│   ignore este email.            │
│                                 │
├─────────────────────────────────┤
│   © 2024 Avion · Termos         │  ← Footer
└─────────────────────────────────┘
```

## Estrutura de Arquivos

```
supabase/functions/
├── send-auth-email/
│   ├── index.ts              # Handler principal
│   └── _templates/
│       ├── base-layout.tsx   # Layout compartilhado
│       ├── welcome.tsx       # Confirmação de conta
│       ├── magic-link.tsx    # Login sem senha
│       ├── password-reset.tsx # Recuperação
│       └── email-change.tsx  # Mudança de email
```

## Configuração Necessária no Supabase

Após criar a Edge Function, você precisará configurar um **Auth Hook** no Supabase Dashboard:

1. Acessar **Authentication** → **Hooks**
2. Criar hook do tipo **Send Email**
3. Apontar para: `https://oruslrvpmdhtnrsgoght.supabase.co/functions/v1/send-auth-email`

## Detalhes Técnicos

### Cores do Tema (inline CSS para emails)
```css
background: #0a0a0f          /* --background */
card: #0f0f14                /* --card */
primary: #a78bfa             /* violet-400 */
secondary: #c084fc           /* purple-400 */
accent: #818cf8              /* indigo-400 */
text: #fafafa                /* --foreground */
muted: #71717a               /* --muted-foreground */
```

### Verificação de Webhook
A função usará `standardwebhooks` para validar a assinatura do request usando o secret `SEND_EMAIL_HOOK_SECRET`.

### Tipos de Email Suportados
- `signup` → Template Welcome
- `magiclink` → Template Magic Link  
- `recovery` → Template Password Reset
- `email_change` → Template Email Change
