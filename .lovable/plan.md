

# Alinhar aspect ratios: frontend e backend

## Problema
O frontend (SettingsNode) oferece `1:1`, `4:5`, `9:16` e `16:9`, mas o backend (`generate-image`) aceita `1:1`, `16:9`, `9:16`, `4:3` e `3:4`. O `4:5` e rejeitado, e `4:3`/`3:4` existem sem necessidade.

## Alteracao

### Arquivo: `supabase/functions/generate-image/index.ts` (linha 96)
Trocar a lista de aspect ratios validos de:
```
['1:1', '16:9', '9:16', '4:3', '3:4']
```
Para:
```
['1:1', '4:5', '16:9', '9:16']
```

Depois, redeployar a edge function `generate-image`.

Nenhuma alteracao no frontend -- o `SettingsNode.tsx` ja tem exatamente esses 4 tamanhos.

