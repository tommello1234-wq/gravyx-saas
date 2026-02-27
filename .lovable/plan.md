

## Diagnóstico: Job travado em `processing`

O modelo `gemini-3.1-flash-image-preview` está correto e confirmado na documentação do Google. O problema é que há **1 job travado** no status `processing` (ID `35715632...`) que nunca terminou. Os jobs anteriores (com o modelo antigo) completaram normalmente em ~30s.

O que provavelmente aconteceu: o deploy da função com o novo modelo ocorreu, mas a chamada à API do Google com `gemini-3.1-flash-image-preview` pode ter demorado mais que o timeout da Edge Function (~150s), ou houve um erro não capturado. O job ficou preso e o polling continua chamando o worker, mas `claim_next_job` não retorna nada novo porque não há outros jobs na fila.

### Passos

1. **Limpar o job travado** -- Executar uma migration SQL para marcar o job `35715632-380f-44bd-85ce-21092a46ebb8` como `failed` com erro `'Timeout - stuck in processing'` e `finished_at = now()`.

2. **Adicionar proteção contra jobs travados** -- Atualizar o `image-worker` para, antes de chamar `claim_next_job`, verificar e resetar jobs que estão em `processing` há mais de 3 minutos (mudar status para `queued` para retry automático). Isso previne que jobs fiquem presos indefinidamente.

3. **Adicionar logging extra** -- Adicionar `console.log` antes e depois da chamada à Google API para diagnosticar se o problema é timeout, erro de modelo, ou outro.

4. **Testar a geração novamente** -- Após limpar o job travado e redeployar, testar uma nova geração para confirmar que o modelo `gemini-3.1-flash-image-preview` funciona corretamente via API.

### Detalhe técnico

O SQL para cleanup:
```sql
UPDATE jobs 
SET status = 'failed', finished_at = now(), error = 'Timeout - stuck in processing'
WHERE id = '35715632-380f-44bd-85ce-21092a46ebb8';
```

A proteção no worker (antes do `claim_next_job`):
```sql
UPDATE jobs SET status = 'queued', retries = retries + 1 
WHERE status = 'processing' AND started_at < now() - interval '3 minutes';
```

