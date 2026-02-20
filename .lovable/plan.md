

## Sistema de Gamificacao Gravyx

### Visao Geral

Implementar um sistema completo de gamificacao com 4 pilares: Streak (ofensiva diaria), Jornada do Criador (10 dias de missoes), Sistema de Niveis e Badges. O sistema sera integrado na Home page e no perfil do usuario.

---

### 1. Banco de Dados - Novas Tabelas

**Tabela `user_streaks`**
- `user_id` (uuid, PK, unique)
- `current_streak` (integer, default 0)
- `last_login_date` (date)
- `longest_streak` (integer, default 0)
- `updated_at` (timestamptz)

**Tabela `user_journey`**
- `user_id` (uuid, PK, unique)
- `journey_start_date` (date) - data do primeiro login apos ativacao
- `current_day` (integer, default 0) - dias de calendario desde o inicio
- `updated_at` (timestamptz)

**Tabela `user_missions`**
- `id` (uuid, PK)
- `user_id` (uuid)
- `day_number` (integer, 1-10)
- `completed` (boolean, default false)
- `reward_claimed` (boolean, default false)
- `completed_at` (timestamptz)
- `claimed_at` (timestamptz)
- Unique constraint em (user_id, day_number)

**Tabela `user_badges`**
- `id` (uuid, PK)
- `user_id` (uuid)
- `badge_id` (text) - ex: 'gravity_explorer', 'flow_builder', '7day_challenger', 'journey_complete', 'architect'
- `earned_at` (timestamptz)
- Unique constraint em (user_id, badge_id)

**Coluna adicional em `profiles`**
- `user_level` (text, default 'beginner') - valores: beginner, creator, strategist, orchestrator, architect

RLS: Todas as tabelas com politicas para usuario ver/editar apenas seus dados. Admin ve tudo.

---

### 2. Logica de Streak

**Ao carregar a Home page:**
1. Consultar `user_streaks` do usuario
2. Se `last_login_date` = hoje: nao fazer nada
3. Se `last_login_date` = ontem: incrementar `current_streak` + 1, atualizar `last_login_date`
4. Se `last_login_date` < ontem: resetar `current_streak` para 1, atualizar `last_login_date`
5. Se nao existe registro: criar com streak = 1

**Visual no Header:** Icone de chama + numero ao lado do avatar, com tooltip explicativo.

---

### 3. Jornada do Criador - 10 Dias

**Logica de desbloqueio:**
- `journey_start_date` e setado no primeiro login apos ativacao do sistema
- `current_day` = diferenca em dias entre hoje e `journey_start_date` + 1 (cap em 10)
- Missoes de dia 1 ate `current_day` ficam desbloqueadas (mesmo que o usuario tenha pulado dias)
- Progresso nunca reseta

**Missoes e verificacao de conclusao:**

| Dia | Missao | Verificacao | Recompensa |
|-----|--------|-------------|------------|
| 1 | Criar primeira arte | `generations` count >= 1 com status 'completed' | +5 creditos |
| 2 | Criar segundo projeto | `projects` count >= 2 | +5 creditos |
| 3 | Usar template pronto | Verificar se algum projeto tem canvas_state com nodes copiados de template (flag no projeto ou consulta) | +5 creditos |
| 4 | Usar Node Gravity | Verificar se algum projeto tem node tipo 'gravity' no canvas_state | Badge "Explorador do Gravity" |
| 5 | 2 resultados no mesmo projeto | Verificar se algum projeto tem >= 2 nodes tipo 'result' no canvas_state | +10 creditos |
| 6 | Editar projeto existente | Verificar se algum projeto foi atualizado apos criacao (updated_at > created_at + 1min) | +10 creditos |
| 7 | Projeto do zero com logo+texto+resultado | Verificar projeto com nodes: prompt + media + result | +15 creditos + Badge "7 Day Challenger" |
| 8 | Pipeline com multiplos resultados conectados | Verificar projeto com >= 2 result nodes com edges conectados | Badge "Construtor de Fluxos" |
| 9 | Variacao estrategica | Verificar >= 2 generations no mesmo projeto | +20 creditos |
| 10 | Estar ativo no 10o dia | Usuario logou no dia 10+ | Presente Surpresa + Badge "Jornada Completa" |

**Visual:** Linha horizontal com 10 circulos, estados: locked/unlocked/completed/reward-pending. Posicionado abaixo das "Criacoes Recentes".

---

### 4. Sistema de Niveis

Calculado dinamicamente com base nas stats do usuario:

| Nivel | Icone | Requisitos |
|-------|-------|------------|
| Iniciante | Verde | 1 projeto, 1 imagem |
| Criador | Azul | 25 imagens, 2 projetos |
| Estrategista | Roxo | 100 imagens, 5 projetos, usou Gravity |
| Orquestrador | Amarelo | 500 imagens, 10 projetos |
| Architect | Laranja/Fogo | 1000 imagens, 15 projetos, 30 dias streak |

Exibido no Header ao lado do badge de plano e na secao de perfil do dropdown.

---

### 5. Sistema de Badges

Secao no dropdown de perfil e no EditProfileModal mostrando badges conquistados com icones minimalistas e tooltips.

---

### 6. Arquivos a Criar/Modificar

**Novos arquivos:**
- `src/lib/gamification.ts` - Constantes de missoes, niveis, badges e funcoes de verificacao
- `src/hooks/useGamification.ts` - Hook principal que gerencia streak, jornada, niveis, badges
- `src/components/gamification/StreakIndicator.tsx` - Icone de chama no header
- `src/components/gamification/JourneySection.tsx` - Secao da jornada de 10 dias na Home
- `src/components/gamification/MissionCard.tsx` - Card individual de missao
- `src/components/gamification/RewardAnimation.tsx` - Animacao de recompensa
- `src/components/gamification/LevelBadge.tsx` - Componente de nivel
- `src/components/gamification/BadgesSection.tsx` - Secao de badges no perfil
- `src/components/gamification/JourneyCompleteModal.tsx` - Modal especial do Dia 10

**Arquivos modificados:**
- `src/components/layout/Header.tsx` - Adicionar StreakIndicator e LevelBadge
- `src/pages/Home.tsx` - Adicionar JourneySection abaixo de criacoes recentes
- `src/components/EditProfileModal.tsx` - Adicionar secao de badges e nivel
- `src/contexts/AuthContext.tsx` - Expor dados de gamificacao
- `src/i18n/pt.ts`, `en.ts`, `es.ts` - Novas strings de traducao
- 1 migration SQL para criar tabelas e politicas RLS

---

### 7. Estilo Visual

- Cores: glow azul sutil (#0040FF com opacidade), gradientes premium
- Animacoes: framer-motion para transicoes suaves, "+X creditos" flutuante
- Streak: chama com pulse sutil quando ativo
- Jornada: linha de progresso com circulos conectados, glassmorphism nos cards
- Dia 10: borda glow especial, icone de presente animado
- Modal Dia 10: overlay escurecido, confetti sutil, botao CTA destaque

---

### 8. Fluxo de Recompensa

1. Missao completada: circulo muda para estado "reward-pending" com botao "Obter recompensa"
2. Usuario clica: animacao de "+X creditos" sobe e desaparece
3. Creditos sao adicionados via `increment_credits` RPC
4. Badge (se aplicavel) e salvo em `user_badges`
5. `user_missions` atualizado com `reward_claimed = true`

### 9. Edge Function

Criar edge function `claim-reward` para processar resgates de forma segura (validar missao, entregar creditos/badge, marcar como claimed). Isso evita manipulacao client-side.

