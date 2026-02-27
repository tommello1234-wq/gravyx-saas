

## Plano: Custo de créditos por resolução (1K=1, 2K=2, 4K=4)

### Alterações

**1. `supabase/functions/generate-image/index.ts`**
- Substituir `CREDITS_PER_IMAGE = 1` por uma função que calcula com base na resolução:
  - `1K` → 1 crédito
  - `2K` → 2 créditos
  - `4K` → 4 créditos
- Atualizar o cálculo de `creditsNeeded` para usar `safeQuantity * creditsForResolution(safeResolution)`
- Incluir a resolução no payload do job (já existe)

**2. `supabase/functions/image-worker/index.ts`**
- Mesma função de cálculo de créditos por resolução
- Na linha 395, trocar `CREDITS_PER_IMAGE` por `creditsForResolution(resolution)` ao debitar créditos por imagem gerada

**3. `src/lib/plan-limits.ts`**
- Atualizar `ESTIMATED_COST_PER_IMAGE_USD` de `0.06` para `0.067` (custo real em 1K com Gemini 3.1 Flash)

### Detalhe técnico

```text
Resolução → Créditos
1K (padrão)  → 1
2K           → 2
4K           → 4
```

A validação de saldo antes de enfileirar o job já usa `creditsNeeded = quantity * X`. Basta trocar X pela função que considera a resolução. O worker já recebe `resolution` no payload.

