
# Corrigir Webhook Ticto: Acesso, Tier e Renovacao Automatica

## Problemas Identificados

1. **Offer codes desatualizados**: O webhook usa codigos antigos que nao correspondem aos novos checkouts
2. **Tier nao atualizado**: Webhook so adiciona creditos, mas nao muda o plano do usuario (tier, max_projects, billing_cycle)
3. **Sem renovacao**: Nao diferencia primeira compra de renovacao recorrente

## Solucao

### Atualizar `supabase/functions/ticto-webhook/index.ts`

**Novo mapeamento de ofertas** com TODOS os 6 codigos (3 mensais + 3 anuais):

```text
O7A4C2615  -> Starter Mensal  (80 creditos,  tier: starter,  max_projects: 3)
OA871890B  -> Starter Anual   (1000 creditos, tier: starter,  max_projects: 3)
O465B8044  -> Premium Mensal  (250 creditos,  tier: premium,  max_projects: -1)
O06B270AF  -> Premium Anual   (3000 creditos, tier: premium,  max_projects: -1)
O8AA396EB  -> Enterprise Mensal (600 creditos, tier: enterprise, max_projects: -1)
OA8BDDA9B  -> Enterprise Anual  (7200 creditos, tier: enterprise, max_projects: -1)
```

**Logica atualizada no webhook:**

Ao receber um pagamento aprovado:
1. Adicionar os creditos ao saldo do usuario
2. Atualizar o `tier` do usuario para o plano correspondente
3. Atualizar o `billing_cycle` para 'monthly' ou 'annual' conforme a oferta
4. Atualizar o `max_projects` conforme o plano
5. Registrar na tabela `credit_purchases` com o `product_id` correto

**Renovacao automatica:**
- A Ticto envia um novo webhook a cada cobranca recorrente (mensal ou anual) com um novo `order.hash`
- Como cada renovacao tem um hash unico, a verificacao de duplicata ja funciona corretamente
- O webhook simplesmente adiciona os creditos novamente e mantem o tier ativo
- Nao precisa de logica especial: cada pagamento = creditos adicionados + tier confirmado

### Estrutura do mapeamento no codigo

Em vez de um simples `Record<string, number>`, o mapeamento passara a ser um objeto completo:

```text
OFFER_CONFIG = {
  'O7A4C2615': { credits: 80,   tier: 'starter',    billing_cycle: 'monthly', max_projects: 3  },
  'OA871890B': { credits: 1000, tier: 'starter',    billing_cycle: 'annual',  max_projects: 3  },
  'O465B8044': { credits: 250,  tier: 'premium',    billing_cycle: 'monthly', max_projects: -1 },
  'O06B270AF': { credits: 3000, tier: 'premium',    billing_cycle: 'annual',  max_projects: -1 },
  'O8AA396EB': { credits: 600,  tier: 'enterprise', billing_cycle: 'monthly', max_projects: -1 },
  'OA8BDDA9B': { credits: 7200, tier: 'enterprise', billing_cycle: 'annual',  max_projects: -1 },
}
```

### O que muda no update do perfil

Antes (so creditos):
```text
UPDATE profiles SET credits = credits + X WHERE user_id = ...
```

Depois (creditos + plano completo):
```text
UPDATE profiles SET
  credits = credits + X,
  tier = '...',
  billing_cycle = '...',
  max_projects = ...
WHERE user_id = ...
```

## Fluxo Completo Apos a Correcao

```text
Usuario clica "Assinar" no modal
  -> Abre checkout Ticto (ex: O465B8044 = Premium Mensal)
  -> Usuario paga
  -> Ticto envia webhook com status "approved"
  -> Webhook identifica oferta O465B8044
  -> Adiciona 250 creditos
  -> Atualiza tier para "premium"
  -> Atualiza billing_cycle para "monthly"
  -> Atualiza max_projects para -1 (ilimitado)
  -> Registra em credit_purchases

30 dias depois (renovacao automatica):
  -> Ticto cobra e envia novo webhook com novo order.hash
  -> Webhook adiciona mais 250 creditos
  -> Tier continua "premium" (ja esta correto)
  -> Novo registro em credit_purchases
```

## Arquivos Alterados

Apenas 1 arquivo: `supabase/functions/ticto-webhook/index.ts`

Nenhuma alteracao de banco de dados necessaria -- as colunas `tier`, `billing_cycle` e `max_projects` ja existem na tabela `profiles`.
