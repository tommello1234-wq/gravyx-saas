

## Adicionar Login com Google

### O que muda

**1. `src/pages/Auth.tsx`** — Adicionar botão "Entrar com Google" acima do formulário de email/senha, chamando `supabase.auth.signInWithOAuth({ provider: 'google' })` com `redirectTo` preservando os params de plan/cycle.

**2. `src/pages/Signup.tsx`** — Mesmo botão "Criar conta com Google", também com redirect para o checkout após autenticação.

**3. Nenhuma mudança no backend** — O Supabase já suporta OAuth nativamente.

### Configuração necessária (feita por você no dashboard)

Antes de funcionar, você precisa:

1. **Google Cloud Console** → criar credenciais OAuth 2.0 (Web Application)
   - Authorized JavaScript origins: `https://node-artistry-12.lovable.app`
   - Authorized redirect URL: `https://oruslrvpmdhtnrsgoght.supabase.co/auth/v1/callback`

2. **Supabase Dashboard** → Authentication → Providers → Google
   - Colar Client ID e Client Secret
   - Habilitar o provider

3. **Supabase Dashboard** → Authentication → URL Configuration
   - Site URL: `https://node-artistry-12.lovable.app`
   - Redirect URLs: adicionar `https://node-artistry-12.lovable.app/**`

### Visual

Botão "Continuar com Google" com ícone, separado do form por um divisor "ou", seguindo o visual glass-card existente.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Auth.tsx` | Modificar — botão Google OAuth |
| `src/pages/Signup.tsx` | Modificar — botão Google OAuth |

Quer prosseguir? Você já tem as credenciais OAuth do Google configuradas?

