

## Reestruturacao Completa do Modelo de Planos: Trial de 7 Dias com Cartao Obrigatorio

### Resumo
Eliminar o plano gratuito (cadastro sem cartao com 5 creditos). Todos os usuarios devem assinar um plano mensal com 7 dias de teste gratuito (cartao obrigatorio via Ticto) ou um plano anual (sem trial, creditos imediatos). Durante o trial, 5 creditos sao liberados por dia (total 35). Apos o trial, o plano e ativado automaticamente ou o acesso e bloqueado.

---

### Mudancas Necessarias

#### 1. Banco de Dados

**Nova coluna `subscription_status` na tabela `profiles`**
- Valores possiveis: `trial_active`, `active`, `inactive`, `cancelled`
- Default: `inactive` (novo usuario sem assinatura)

**Nova coluna `trial_start_date` na tabela `profiles`**
- `TIMESTAMPTZ`, nullable
- Marca quando o trial comecou

**Nova coluna `trial_credits_given` na tabela `profiles`**
- `INTEGER DEFAULT 0`
- Rastreia quantos creditos de trial ja foram liberados (max 35)

**Alterar default da coluna `credits`**
- De `5` para `0` (novos usuarios nao recebem mais creditos ao cadastrar)

**Remover CHECK constraint do tier** (ou manter, mas o tier `free` deixa de ser usado no fluxo normal)

**Nova funcao SQL `grant_daily_trial_credits()`**
- Roda via pg_cron (ou Edge Function com cron)
- Para cada usuario com `subscription_status = 'trial_active'` e `trial_start_date` dentro de 7 dias:
  - Se `trial_credits_given < 35`, adiciona 5 creditos e incrementa `trial_credits_given += 5`
  - Se `trial_start_date + 7 dias < now()`, muda status para `inactive` (trial expirado sem pagamento)

#### 2. Edge Function: `trial-daily-credits` (NOVA)
- Executada diariamente via cron (pg_cron ou Supabase Cron)
- Seleciona usuarios com `subscription_status = 'trial_active'`
- Para cada um: verifica se ja se passou 1 dia desde a ultima liberacao e se `trial_credits_given < 35`
- Libera 5 creditos e atualiza `trial_credits_given`
- Se o trial expirou (> 7 dias), muda status para `inactive`

#### 3. Edge Function: `ticto-webhook` (ALTERACOES)

**Novo evento: `trial` / `periodo de testes`**
- Atualmente esta como "info only" (apenas loga)
- Alterar para: criar/ativar o trial do usuario
  - `subscription_status = 'trial_active'`
  - `trial_start_date = now()`
  - `trial_credits_given = 5` (primeira parcela)
  - `credits = 5`
  - `tier` = tier do plano assinado (starter/premium/enterprise)

**Evento de aprovacao (apos trial)**
- Manter logica atual de adicionar creditos do plano
- Adicionar: `subscription_status = 'active'`
- Zerar `trial_credits_given`

**Evento de cancelamento/falha apos trial**
- `subscription_status = 'inactive'`
- Bloquear geracao

**Evento `encerrada`**
- Manter downgrade + `subscription_status = 'inactive'`

#### 4. Frontend: Bloqueio de Geracao

**`src/components/nodes/ResultNode.tsx`**
- Alem de verificar creditos, verificar `profile.subscription_status`
- Permitir geracao APENAS se `subscription_status === 'trial_active' || subscription_status === 'active'`
- Se `inactive`/`cancelled`: mostrar mensagem "Assine um plano para gerar imagens" com botao para abrir BuyCreditsModal

**`src/components/nodes/GravityNode.tsx`**
- Mesma logica de bloqueio

#### 5. Frontend: Modal de Planos (`BuyCreditsModal.tsx`)

**Adicionar nos planos mensais:**
- Novo bullet: "Teste gratuitamente por 7 dias" com icone de interrogacao
- Tooltip ao passar o mouse com o texto completo fornecido
- Adicionar linha: "Cartao obrigatorio. Cancelamento simples."

**Nao mostrar trial nos planos anuais**

#### 6. Frontend: Pagina de Auth (`Auth.tsx`)

**Alterar textos:**
- Remover "Comece a criar imagens com IA gratuitamente"
- Substituir por "Crie sua conta para comecar" (ou similar)

#### 7. Frontend: Landing Page (`Index.tsx`)

**Alterar textos:**
- "Comecar gratis" -> "Comecar agora" ou "Assinar e comecar"
- "Crie sua conta gratuitamente e ganhe 5 creditos para testar" -> "Assine um plano e comece a criar com 7 dias gratis"
- "Criar conta gratis" -> "Comecar agora"

#### 8. Frontend: Pagina Home (`Home.tsx`)

**Adicionar verificacao de status:**
- Se `subscription_status === 'inactive'`: mostrar banner/CTA proeminente para assinar
- Mostrar dias restantes do trial se `subscription_status === 'trial_active'`
- Mostrar creditos de trial restantes

#### 9. AuthContext (`AuthContext.tsx`)

**Atualizar interface `Profile`:**
- Adicionar `subscription_status: string`
- Adicionar `trial_start_date: string | null`
- Adicionar `trial_credits_given: number`

#### 10. Plan Limits (`plan-limits.ts`)

**Remover ou manter `free` mas sem uso ativo:**
- O tier `free` pode continuar existindo no banco para usuarios legados
- Novos usuarios nunca terao tier `free` - eles terao o tier do plano que assinaram desde o trial

---

### Detalhes Tecnicos

**Migracao SQL:**
```sql
-- Novas colunas
ALTER TABLE profiles ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN trial_start_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN trial_credits_given INTEGER NOT NULL DEFAULT 0;

-- Alterar default de creditos
ALTER TABLE profiles ALTER COLUMN credits SET DEFAULT 0;

-- Constraint de status
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check 
  CHECK (subscription_status IN ('trial_active', 'active', 'inactive', 'cancelled'));

-- Migrar usuarios existentes com tier pago para 'active'
UPDATE profiles SET subscription_status = 'active' WHERE tier IN ('starter', 'premium', 'enterprise');
-- Usuarios free existentes ficam como 'inactive'
UPDATE profiles SET subscription_status = 'inactive' WHERE tier = 'free';
```

**Edge Function `trial-daily-credits`:**
- Usa `SUPABASE_SERVICE_ROLE_KEY` para acessar perfis
- Query: usuarios com `subscription_status = 'trial_active'` e `trial_credits_given < 35`
- Para cada: verifica se a diferenca de dias entre `trial_start_date` e agora justifica nova liberacao
- Calcula: `dias_passados = floor((now - trial_start_date) / 1 dia)`, `creditos_esperados = min(35, (dias_passados + 1) * 5)`
- Se `creditos_esperados > trial_credits_given`: libera a diferenca
- Se `dias_passados >= 7` e status ainda trial: muda para `inactive`

**Webhook Ticto - fluxo do trial:**
1. Usuario assina plano mensal na Ticto (com 7 dias gratis)
2. Ticto envia webhook com status "periodo de testes" ou "trial"
3. Webhook ativa trial: `subscription_status = 'trial_active'`, `trial_start_date = now()`, `credits = 5`, `trial_credits_given = 5`, `tier = plano escolhido`
4. Edge Function diaria libera 5 creditos/dia
5. Apos 7 dias, Ticto cobra o cartao:
   - Aprovado: webhook de aprovacao -> `subscription_status = 'active'`, libera creditos do plano
   - Falhou: webhook de falha -> `subscription_status = 'inactive'`

**Bloqueio de geracao no ResultNode:**
```typescript
const canGenerate = (profile?.subscription_status === 'trial_active' || 
                     profile?.subscription_status === 'active') && 
                    hasEnoughCredits;
```

**Tooltip no BuyCreditsModal (planos mensais):**
```
Voce pode testar gratuitamente por 7 dias.
Durante o teste, voce recebera 35 creditos no total, 
liberados diariamente (5 creditos por dia) para 
experimentar a ferramenta.
Voce pode cancelar a qualquer momento.
Apos os 7 dias, sua assinatura sera ativada 
automaticamente e os creditos completos do plano 
serao liberados.
```

---

### Arquivos Afetados

| Arquivo | Tipo de Alteracao |
|---|---|
| `supabase/migrations/` | Nova migracao (colunas + constraints) |
| `supabase/functions/trial-daily-credits/index.ts` | NOVO - cron de creditos diarios |
| `supabase/functions/ticto-webhook/index.ts` | Alterado - suporte a trial |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |
| `src/contexts/AuthContext.tsx` | Novos campos no Profile |
| `src/components/nodes/ResultNode.tsx` | Bloqueio por subscription_status |
| `src/components/nodes/GravityNode.tsx` | Bloqueio por subscription_status |
| `src/components/BuyCreditsModal.tsx` | Bullet trial + tooltip + texto cartao |
| `src/pages/Auth.tsx` | Remover textos "gratis" |
| `src/pages/Index.tsx` | Remover textos "gratis" |
| `src/pages/Home.tsx` | Banner de status do trial/assinatura |
| `src/lib/plan-limits.ts` | Ajustes menores |

---

### Ordem de Implementacao

1. Migracao de banco (novas colunas, constraints, migrar usuarios existentes)
2. AuthContext (novos campos)
3. Edge Function `trial-daily-credits`
4. Alteracoes no `ticto-webhook` (suporte a trial e subscription_status)
5. Bloqueio de geracao (ResultNode + GravityNode)
6. UI do BuyCreditsModal (bullet trial, tooltip, texto cartao)
7. Textos da landing page e auth
8. Banner de trial na Home

