

## Corrigir bypass completo para admins na Home

O problema: na Home, a variavel `isFree` nao leva em conta o `isAdmin`, diferente da Library e LibraryModal que ja fazem `tier === 'free' && !isAdmin`. Alem disso, o badge de plano mostra "Free" e o CTA de upgrade aparece para admins.

### Alteracoes em `src/pages/Home.tsx`

1. **Linha 89** — Alterar `isFree` para incluir check de admin:
   - De: `const isFree = tier === 'free';`
   - Para: `const isFree = tier === 'free' && !isAdmin;`

2. **Linha 231** — Alterar `showUpgrade` para excluir admin:
   - De: `const showUpgrade = tier === 'free' || tier === 'starter';`
   - Para: `const showUpgrade = !isAdmin && (tier === 'free' || tier === 'starter');`

3. **Linhas 282-284** — Alterar badge do tier para mostrar "Admin" quando for admin:
   - De: `{tierLabels[tier] ?? tier}`
   - Para: `{isAdmin ? 'Admin' : (tierLabels[tier] ?? tier)}`

Com essas 3 alteracoes, admins nunca verao tag "Free", nunca verao conteudo bloqueado, e nunca verao o CTA de upgrade.

