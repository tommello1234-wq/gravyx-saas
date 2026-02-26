

## Compra Avulsa de Créditos para Assinantes Ativos

### Contexto
Usuários com plano ativo querem comprar créditos extras sem assinar novamente. Hoje o modal só mostra planos. Vamos adicionar uma seção abaixo dos cards de planos para compra avulsa, visível apenas para quem já tem plano ativo (`tier !== 'free'` e `subscription_status === 'active'`).

### Mudanças

**1. Tabela `credit_packages` (já existe no banco)**
- Usar os pacotes já cadastrados na tabela `credit_packages` para exibir as opções de compra avulsa.
- Criar um hook `useCreditPackages` para buscar os pacotes ativos.

**2. `src/hooks/useCreditPackages.ts` (novo)**
- Query simples na tabela `credit_packages` ordenada por `credits`.

**3. `src/components/BuyCreditsModal.tsx`**
- Após o grid de planos, se `currentTier !== 'free'`, renderizar seção "Créditos Extras":
  - Título com ícone: "Precisa de mais créditos?"
  - Cards horizontais com os pacotes da `credit_packages` (nome, créditos, preço)
  - Botão "Comprar" em cada pacote que abre o checkout transparente
- Adicionar estado `selectedPackage` para controlar quando um pacote avulso é selecionado
- Ao selecionar pacote, abrir `AsaasTransparentCheckout` adaptado para compra avulsa

**4. `src/components/AsaasTransparentCheckout.tsx`**
- Adicionar prop opcional `isOneOff?: boolean` (default false)
- Quando `isOneOff`, enviar flag `oneOff: true` no body para a edge function

**5. `supabase/functions/process-asaas-payment/index.ts`**
- Adicionar CASE 3: compra avulsa (`oneOff: true`)
  - Criar cobrança única no Asaas (`/v3/payments`) sem subscription
  - Bypass do guard de "já tem plano ativo" quando `oneOff` é true
  - Registrar em `credit_purchases` igual aos outros cases
  - Não alterar tier/subscription do usuário, apenas adicionar créditos

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useCreditPackages.ts` | Criar |
| `src/components/BuyCreditsModal.tsx` | Modificar — adicionar seção de pacotes avulsos |
| `src/components/AsaasTransparentCheckout.tsx` | Modificar — suportar modo oneOff |
| `supabase/functions/process-asaas-payment/index.ts` | Modificar — CASE 3 cobrança avulsa |

