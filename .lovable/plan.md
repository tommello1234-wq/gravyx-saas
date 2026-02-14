
## Correção do valor parcelado do plano Starter Anual

Alteração simples no arquivo `src/components/BuyCreditsModal.tsx`:

- **Linha 34**: Trocar o valor do `installment` de `'R$ 35'` para `'R$ 43,44'` no plano Starter anual.

### Detalhe técnico
No objeto do plano `starter`, propriedade `annual.installment`, o valor será atualizado de `R$ 35` para `R$ 43,44`.
