

# Corrigir Bug de Creditos: Deducao Nao-Atomica

## Problema Encontrado

O usuario `gitoxi4169@flemist.com` tem 6 creditos mas deveria ter no maximo 5 (padrao). Ele gerou 4 jobs (8 imagens), o que deveria ter consumido 8 creditos -- impossivel com apenas 5.

### Causa Raiz

A funcao `decrement_credits` no banco de dados **sempre rejeita** chamadas do service_role porque verifica `auth.uid()`, que e `NULL` para service_role:

```sql
IF auth.uid() IS NULL OR auth.uid() != uid THEN
    RAISE EXCEPTION 'Unauthorized';
END IF;
```

Quando falha, o `generate-image` usa um fallback nao-atomico:
```js
.update({ credits: profile.credits - creditsNeeded })
```
Isso lê o saldo e depois escreve, criando uma janela de race condition. Se 2 requests leem `credits=5` ao mesmo tempo, ambos escrevem `credits=3` -- apenas 2 creditos sao deduzidos em vez de 4.

### Bug Secundario: Refund Duplo no Worker

O `image-worker` tenta fazer refund de creditos em duas etapas (linhas 236-254): uma com um RPC `increment` que nao existe, e outra lendo/escrevendo manualmente. Mesmo que a primeira falhe, a logica e fragil e confusa.

## Plano de Correcao

### 1. Corrigir a funcao `decrement_credits` (migracao SQL)

Permitir chamadas do service_role (quando `auth.uid()` e NULL) ja que o service_role e confiavel. Manter a verificacao de ownership para chamadas de usuarios normais.

```sql
-- Se auth.uid() e NULL = service_role (confiavel, permitir)
-- Se auth.uid() != uid = usuario tentando deduzir de outro (bloquear)
IF auth.uid() IS NOT NULL AND auth.uid() != uid THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other users credits';
END IF;
```

### 2. Remover o fallback nao-atomico no `generate-image`

**Arquivo**: `supabase/functions/generate-image/index.ts`

Remover as linhas 128-135 (o fallback que faz `update` direto). Se o RPC falhar, retornar erro ao usuario em vez de usar um caminho inseguro.

### 3. Corrigir a logica de refund no `image-worker`

**Arquivo**: `supabase/functions/image-worker/index.ts`

Substituir o bloco duplo de refund (linhas 236-254) por uma unica operacao atomica usando um novo RPC `increment_credits`, ou pelo menos remover a tentativa com o RPC inexistente `increment` e manter apenas a leitura/escrita direta.

### 4. Corrigir o saldo do usuario manualmente

Depois da correcao, voce pode ajustar o saldo do usuario via painel admin para o valor correto.

## Detalhes Tecnicos

### Migracao SQL

Alterar `decrement_credits` para aceitar service_role:

```sql
CREATE OR REPLACE FUNCTION public.decrement_credits(uid uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_credits integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != uid THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other users credits';
  END IF;
  
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be positive';
  END IF;
  
  UPDATE profiles
  SET credits = credits - amount
  WHERE user_id = uid
  RETURNING credits INTO new_credits;
  
  IF new_credits < 0 THEN
    UPDATE profiles
    SET credits = credits + amount
    WHERE user_id = uid;
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  RETURN new_credits;
END;
$$;
```

### generate-image/index.ts

Remover fallback (linhas 128-135), manter apenas o RPC e retornar erro se falhar.

### image-worker/index.ts

Substituir refund parcial (linhas 236-254) por:
```js
if (failedCount > 0) {
  const refundAmount = failedCount * CREDITS_PER_IMAGE;
  const { data: currentProfile } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('user_id', claimedJob.user_id)
    .single();
  if (currentProfile) {
    await supabaseAdmin
      .from('profiles')
      .update({ credits: currentProfile.credits + refundAmount })
      .eq('user_id', claimedJob.user_id);
  }
  console.log(`Refunded ${refundAmount} credits for ${failedCount} failed generation(s)`);
}
```

Mesma correcao para o refund total nas linhas 346-358 (que ja esta correto, manter como esta).

### Arquivos Afetados
- Nova migracao SQL (corrigir `decrement_credits`)
- `supabase/functions/generate-image/index.ts` (remover fallback)
- `supabase/functions/image-worker/index.ts` (corrigir refund duplo)

