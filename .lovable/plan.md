

## Atualizar features dos planos no modal de preços

### O que muda

Atualizar o array `features` de cada plano no arquivo `src/components/BuyCreditsModal.tsx`:

**Starter** (linha 35):
- `80 créditos/mês` (manter)
- `Até 3 projetos ativos`
- `Templates essenciais`
- `Acesso completo à biblioteca de referências`

**Premium** (linha 45):
- `250 créditos/mês` (manter)
- `Projetos ilimitados`
- `Acesso a todos os Templates de Fluxos`
- `Acesso completo à biblioteca de referências`

**Enterprise** (linha 54):
- `600 créditos/mês` (manter)
- `Projetos ilimitados`
- `Acesso a todos os Templates de Fluxos`
- `Acesso completo à biblioteca de referências`
- `Acesso antecipado a novas ferramentas`

### Detalhe técnico

Alteração apenas nas propriedades `features` dos 3 objetos do array `plans` em `src/components/BuyCreditsModal.tsx`. Nenhuma lógica ou outro arquivo precisa ser alterado.

