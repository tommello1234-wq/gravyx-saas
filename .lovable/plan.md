

# Redesign da Trilha de Conquistas - Missoes com Verificacao Real

## Problema Atual
- Qualquer dia desbloqueado aparece como "pronto para resgatar" (icone de presente pulsando), mesmo sem a pessoa ter feito nada.
- O clique no circulo resgata direto os creditos sem mostrar o que precisa ser feito.
- O popover so aparece em dias desbloqueados e nao explica claramente a tarefa.
- Dia 10 nao tem destaque especial.

## Solucao

### 1. Novo fluxo de interacao

Ao clicar em qualquer dia (incluindo bloqueados), abre um popover detalhado com:
- Titulo da missao
- Descricao do que precisa fazer
- Recompensa (creditos ou badge)
- Status: bloqueado / a fazer / concluido / resgatado
- Botao "Resgatar" apenas quando a missao foi concluida

O resgate NAO acontece mais ao clicar no circulo. O circulo apenas abre o popover. O botao de resgate fica DENTRO do popover.

### 2. Verificacao de conclusao no cliente

Criar uma funcao que verifica localmente se cada missao foi concluida (espelhando a logica do `claim-reward`), usando dados ja disponiveis no app (projetos, geracoes, canvas_state). Isso permite mostrar visualmente "Missao concluida - resgatar!" vs "Voce ainda precisa fazer X".

### 3. Estados visuais dos circulos (4 estados)

- **Bloqueado** (cadeado cinza): dia ainda nao chegou
- **A fazer** (circulo vazio com borda): dia desbloqueado, missao nao concluida
- **Pronto para resgatar** (presente pulsando): missao concluida, recompensa disponivel
- **Resgatado** (check verde): ja resgatou

### 4. Dia 10 com destaque especial

- Circulo maior com brilho dourado
- Icone de presente especial
- No popover: banner destacado com "Presente Surpresa" e descricao do treinamento
- Animacao de confete ao resgatar

## Detalhes Tecnicos

### Arquivos a modificar

**`src/components/gamification/JourneySection.tsx`**
- Remover o `onClick` do `motion.button` que faz resgate direto
- Adicionar hook de verificacao de missoes
- Mover botao de resgate para dentro do `PopoverContent`
- Mostrar popover para TODOS os dias (inclusive bloqueados)
- Adicionar 4 estados visuais
- Estilizar Dia 10 com classes especiais (borda dourada, glow maior, escala)

**`src/lib/gamification.ts`** (novo export)
- Adicionar funcao `checkMissionCompletion(day, userData)` que verifica no cliente se cada missao esta concluida, usando os mesmos criterios do edge function:
  - Dia 1: total_generations >= 1
  - Dia 2: projetos >= 2
  - Dia 3: projetos >= 1 (uso de template)
  - Dia 4: algum projeto com node gravity
  - Dia 5: algum projeto com 2+ result nodes
  - Dia 6: algum projeto editado (updated > created + 1min)
  - Dia 7: projeto com prompt + media + result
  - Dia 8: pipeline com 2+ results conectados
  - Dia 9: 2+ geracoes em um projeto
  - Dia 10: 10+ dias desde inicio da jornada

**`src/hooks/useGamification.ts`**
- Adicionar query para buscar dados necessarios para verificacao (projetos com canvas_state, geracoes por projeto)
- Exportar `missionCompletionStatus: Record<number, boolean>`

**`src/i18n/pt.ts`**, **`src/i18n/en.ts`**, **`src/i18n/es.ts`**
- Adicionar traducoes para novos textos:
  - `gamification.mission_locked` ("Dia ainda nao disponivel")
  - `gamification.mission_todo` ("Complete a tarefa para desbloquear")
  - `gamification.claim_reward` ("Resgatar recompensa")
  - `gamification.mission_requirement` ("O que fazer:")
  - `gamification.day10_highlight` (texto especial pro dia 10)

### Edge function `claim-reward`
- Sem mudancas - ja faz a verificacao correta no servidor. O cliente agora tambem verificara antes de habilitar o botao, mas a validacao final continua no servidor.

