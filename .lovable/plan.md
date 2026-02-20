
## Correcao: Historico de Geracoes Permanente

### Problema
Quando um usuario exclui imagens da galeria, as linhas sao removidas da tabela `generations`. O sistema de gamificacao (niveis, missoes) conta essas linhas para calcular progresso, entao o contador cai de 39 para 6 quando o usuario limpa a galeria.

### Solucao
Adicionar um contador permanente `total_generations` na tabela `profiles` que so incrementa e nunca diminui. Esse contador sera a fonte de verdade para gamificacao e niveis.

### Mudancas

**1. Banco de Dados**
- Adicionar coluna `total_generations` (integer, default 0) na tabela `profiles`
- Criar uma funcao SQL `increment_total_generations(uid)` que incrementa o contador em 1
- Backfill: popular o valor inicial para todos os usuarios existentes contando as `generations` atuais com status 'completed' (nota: usuarios que ja deletaram imagens nao terao o historico recuperado, mas a partir de agora o contador sera correto)

**2. Edge Function / Fluxo de Geracao**
- No momento em que uma geracao e marcada como `completed`, chamar `increment_total_generations` para incrementar o contador no perfil
- Isso acontece no fluxo do worker (`image-worker` ou `generate-image`)

**3. Frontend - useGamification.ts**
- Alterar a query `gamification-level-stats` para buscar `total_generations` do `profiles` em vez de contar linhas da tabela `generations`
- Isso corrige o calculo de nivel automaticamente

**4. Edge Function - claim-reward**
- Missao 1 (criar primeira arte): usar `total_generations >= 1` do `profiles` em vez de contar `generations`
- Missao 9 (2 geracoes no mesmo projeto): essa continua consultando `generations` por projeto, pois precisa saber o projeto especifico - mas como a missao e resgatada antes de deletar, normalmente funciona

### Detalhes Tecnicos

**Migration SQL:**
```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS total_generations integer NOT NULL DEFAULT 0;

-- Backfill com dados atuais
UPDATE public.profiles p
SET total_generations = COALESCE(
  (SELECT COUNT(*) FROM public.generations g 
   WHERE g.user_id = p.user_id AND g.status = 'completed'), 0
);

-- Funcao para incrementar (service role only)
CREATE OR REPLACE FUNCTION public.increment_total_generations(uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Service role only';
  END IF;
  UPDATE public.profiles
  SET total_generations = total_generations + 1, updated_at = now()
  WHERE user_id = uid;
END;
$$;
```

**Arquivos modificados:**
- `supabase/functions/image-worker/index.ts` ou `generate-image/index.ts` - chamar `increment_total_generations` ao completar geracao
- `src/hooks/useGamification.ts` - ler `total_generations` de `profiles` em vez de contar `generations`
- `supabase/functions/claim-reward/index.ts` - missao 1 usar `total_generations` do perfil
- Migration SQL para adicionar coluna e backfill
