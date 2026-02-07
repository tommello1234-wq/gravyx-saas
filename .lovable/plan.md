
# Plano: Implementar Sistema Assíncrono de Geração de Imagens

## Resumo

O Supabase já criou a estrutura do banco de dados (colunas `result_urls`, `result_count`, `next_run_at` e funções SQL). Agora vou implementar as Edge Functions e atualizar o frontend para usar o sistema de fila assíncrona.

---

## O que será feito

### 1. Criar Edge Function `image-worker`

**Arquivo:** `supabase/functions/image-worker/index.ts`

Esta função será responsável por processar jobs em background:

- Chama `claim_next_job()` para pegar o próximo job disponível
- Extrai payload (prompt, aspectRatio, quantity, imageUrls)
- Gera imagens chamando o AI Gateway (Lovable AI)
- Faz upload para Storage (bucket `generations`)
- Registra imagens na tabela `generations`
- Atualiza job com `complete_job_with_result()`
- Em caso de erro: incrementa `retries`, define `next_run_at` com backoff exponencial

**Lógica de Retry/Backoff:**
- Retry 1: espera 5 segundos
- Retry 2: espera 10 segundos
- Retry 3: espera 20 segundos
- Após 3 tentativas: marca como `failed` e reembolsa créditos

---

### 2. Refatorar Edge Function `generate-image`

**Arquivo:** `supabase/functions/generate-image/index.ts`

Transformar de "geração síncrona" para "enqueue only":

**Antes (síncrono):**
```
Usuário → generate-image → AI Gateway → Storage → Resposta
          (espera 30-60s)
```

**Depois (assíncrono):**
```
Usuário → generate-image → Insere job → Resposta imediata
          (< 1 segundo)
```

**Fluxo simplificado:**
1. Validar usuário e créditos
2. Deduzir créditos atomicamente
3. Inserir job na tabela `jobs` com payload
4. Retornar `{ jobId, status: 'queued' }` imediatamente

---

### 3. Atualizar `config.toml`

**Arquivo:** `supabase/config.toml`

Adicionar configuração do `image-worker`:

```toml
[functions.image-worker]
verify_jwt = false
```

---

### 4. Atualizar Frontend (`Editor.tsx`)

**Arquivo:** `src/pages/Editor.tsx`

Mudanças principais:

1. **Estado de jobs pendentes:**
   - Novo estado `pendingJobs` para rastrear jobs em andamento
   
2. **Modificar `handleGenerate`:**
   - Chamar `generate-image` (agora retorna jobId)
   - Adicionar jobId à lista de pendentes
   - Mostrar toast "Geração iniciada"

3. **Implementar Supabase Realtime:**
   - Assinar canal `postgres_changes` para a tabela `jobs`
   - Filtrar por `project_id`
   - Quando job for `completed`: adicionar imagens ao OutputNode
   - Quando job for `failed`: mostrar erro

4. **Implementar Polling do Worker:**
   - Enquanto houver jobs pendentes, chamar `image-worker` a cada 3 segundos
   - Isso garante que os jobs sejam processados mesmo sem Realtime

---

### 5. Atualizar `SettingsNode.tsx`

**Arquivo:** `src/components/nodes/SettingsNode.tsx`

Mostrar estados intermediários:
- "Gerando..." quando há jobs em `processing`
- "Na fila..." quando há jobs em `queued`
- Indicador de progresso (ex: "2 de 4 imagens geradas")

---

## Arquitetura Final

```text
┌─────────────┐    enqueue    ┌─────────────┐
│   Frontend  │──────────────>│    jobs     │
│  (Editor)   │               │   (table)   │
└──────┬──────┘               └──────┬──────┘
       │                             │
       │  Realtime                   │ claim_next_job()
       │  (status updates)           │
       │                             v
       │                    ┌─────────────────┐
       └<───────────────────│  image-worker   │
                            │ (Edge Function) │
                            └────────┬────────┘
                                     │
                          ┌──────────┼──────────┐
                          v          v          v
                    ┌─────────┐ ┌─────────┐ ┌──────────┐
                    │ AI API  │ │ Storage │ │generations│
                    └─────────┘ └─────────┘ └──────────┘
```

---

## Benefícios

| Antes (Síncrono) | Depois (Assíncrono) |
|------------------|---------------------|
| Timeout após 30-60s | Resposta em < 1s |
| 4 usuários = 4 conexões bloqueadas | Fila processa ordenadamente |
| Falha = perda total | Retry automático com backoff |
| Sem visibilidade | Jobs rastreáveis no banco |

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/image-worker/index.ts` | **Criar** |
| `supabase/functions/generate-image/index.ts` | **Modificar** (enqueue only) |
| `supabase/config.toml` | **Modificar** (adicionar image-worker) |
| `src/pages/Editor.tsx` | **Modificar** (Realtime + polling + jobs pendentes) |
| `src/components/nodes/SettingsNode.tsx` | **Modificar** (estados de fila) |

---

## Resposta sugerida para o Supabase

Você pode responder ao Supabase:

> "Perfeito! O banco de dados está pronto. Vou implementar o restante pelo Lovable:
> - Edge Function `image-worker` com a lógica real de geração
> - Refatorar `generate-image` para enqueue-only
> - Atualizar o frontend com Realtime e polling
>
> Não precisa fazer mais nada por aí. Obrigado!"
