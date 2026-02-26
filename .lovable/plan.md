

## Plano: Remover opção "Personalizado" do dropdown de formato

### `src/components/nodes/ResultNode.tsx`

1. Remover a opção `{ value: 'custom', label: 'Personalizado' }` do array `formatOptions`
2. Remover os estados `customW`, `customH`, `showCustomInput`
3. Remover a função `handleCustomConfirm`
4. Remover a lógica de `value === 'custom'` no `handleAspectChange`
5. Remover o bloco de renderização condicional do input custom dentro do Popover
6. Remover a lógica `isCustomRatio` do label do trigger

### `src/pages/Editor.tsx`

7. Restaurar o mapeamento de ratios desconhecidos para o preset mais próximo (fallback seguro)

### `supabase/functions/generate-image/index.ts`

8. Restaurar validação restritiva com whitelist dos 4 ratios válidos (`1:1`, `4:5`, `16:9`, `9:16`)

