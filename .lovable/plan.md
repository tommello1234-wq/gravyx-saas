
Do I know what the issue is? Sim.

### Problema confirmado
- `image-worker` está quebrando por **Memory limit exceeded** ao processar referências grandes (logs mostram 2.97MB + 10.12MB e erro 546).
- Jobs ficam presos em `processing` e entram em loop porque o auto-recovery atual apenas volta para `queued` sem incrementar `retries`.

### Plano de implementação

1. **Parar o loop atual de jobs presos (DB)**
   - Criar migração para finalizar como `failed` os jobs antigos em `processing` (threshold de segurança, ex. > 5 min), com mensagem de erro clara.
   - Objetivo: limpar imediatamente o estado travado no editor.

2. **Corrigir recovery no `image-worker` para não loopar infinitamente**
   - Arquivo: `supabase/functions/image-worker/index.ts`
   - Trocar o bloco de auto-recovery para:
     - incrementar `retries` quando recuperar job travado;
     - aplicar `next_run_at` com backoff;
     - marcar `failed` quando atingir `max_retries`.
   - Garantir que qualquer recuperação já registre erro técnico (`timeout/memory`) no job.

3. **Remover gargalo de memória sem compressão (manter qualidade original)**
   - Arquivo: `supabase/functions/image-worker/index.ts`
   - Substituir envio de referências via `inline_data` base64 por fluxo com **Gemini Files API** (`file_data`/`file_uri`) para evitar JSON gigante em memória.
   - Manter upload original no frontend (sem resize/compressão), preservando fidelidade da imagem.
   - Limpar arquivos temporários no Gemini após uso (best effort).

4. **Evitar loading infinito na UI mesmo em falhas extremas**
   - Arquivo: `src/hooks/useJobQueue.ts`
   - Adicionar timeout de segurança no estado local de pending job (ex. 6–8 min): remove job da fila local e dispara `onJobFailed` com mensagem amigável.
   - Em restauração inicial, ignorar jobs muito antigos já fora da janela operacional.

5. **Validação final**
   - Cenário A: 2 referências grandes (ex. ~3MB + ~10MB) → deve completar sem loop.
   - Cenário B: arquivo >20MB no MediaNode → deve bloquear com toast de limite.
   - Cenário C: erro real do worker → job deve virar `failed` (sem ficar reprocessando para sempre) e UI deve sair do loading.

### Detalhes técnicos (arquivos impactados)
- `supabase/functions/image-worker/index.ts`
- `src/hooks/useJobQueue.ts`
- `supabase/migrations/<timestamp>_fix_stuck_jobs_and_recovery.sql`
