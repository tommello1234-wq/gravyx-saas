

# Remover Troca Manual de Plano do Admin

## Motivacao

A troca de plano deve ser 100% automatica via webhook da Ticto. Manter a opcao manual no admin cria risco de conflito e inconsistencia entre o que o gateway registra e o que esta no banco.

## Alteracoes

### 1. `src/components/admin/dashboard/UsersTable.tsx`
- Remover o componente `PlanPopover` inteiro (linhas 32-103)
- Remover a prop `onChangeTier` da interface `UsersTableProps`
- Na tabela, substituir o `PlanPopover` por um simples `Badge` read-only mostrando o plano atual (sem interacao)

### 2. `src/pages/Admin.tsx`
- Remover a `changeTierMutation` inteira
- Remover a prop `onChangeTier` passada para `UsersTable`

### 3. Imports
- Remover imports nao mais usados: `Popover`, `PopoverContent`, `PopoverTrigger`, `RadioGroup`, `RadioGroupItem`, `Label` do UsersTable (se nao forem usados em outro lugar do arquivo)
- Remover imports de `ALL_TIERS`, `PLAN_LIMITS`, `TierKey` do UsersTable

O plano do usuario continuara visivel na tabela como informacao, apenas sem a opcao de editar manualmente.
