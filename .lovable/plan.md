

## Liberar geração de imagens para admins

O problema: nos componentes `GravityNode` e `ResultNode`, a variável `hasActiveSubscription` só verifica `subscription_status === 'trial_active' || 'active'`, sem considerar `isAdmin`. Como o perfil de admin tem status `inactive`, o botão de gerar fica desabilitado e aparece "Assine um plano para gerar imagens".

### Alterações

#### 1. `src/components/nodes/GravityNode.tsx`

- Importar `isAdmin` do `useAuth()` (já importa `profile`, basta adicionar `isAdmin`)
- Alterar a linha 62:
  - De: `const hasActiveSubscription = profile?.subscription_status === 'trial_active' || profile?.subscription_status === 'active';`
  - Para: `const hasActiveSubscription = isAdmin || profile?.subscription_status === 'trial_active' || profile?.subscription_status === 'active';`
- Remover o check `!hasActiveSubscription` do disabled do botão (linha 324), ou manter como está pois agora `hasActiveSubscription` será `true` para admins

#### 2. `src/components/nodes/ResultNode.tsx`

- Importar `isAdmin` do `useAuth()` (adicionar ao destructuring existente)
- Alterar a linha 248:
  - De: `const hasActiveSubscription = profile?.subscription_status === 'trial_active' || profile?.subscription_status === 'active';`
  - Para: `const hasActiveSubscription = isAdmin || profile?.subscription_status === 'trial_active' || profile?.subscription_status === 'active';`
- A mensagem "Assine um plano para gerar imagens" deixará de aparecer para admins automaticamente

Com essas 2 alterações, admins poderão gerar imagens independentemente do `subscription_status`.

