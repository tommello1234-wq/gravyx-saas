# Plano: Sistema Assíncrono de Geração de Imagens

## ✅ Status: CONCLUÍDO

O sistema de fila assíncrona foi implementado com sucesso.

---

## O que foi implementado

### 1. ✅ Edge Function `image-worker`
- Processa jobs em background
- Retry com backoff exponencial (5s, 10s, 20s)
- Reembolso automático de créditos em caso de falha
- Upload para Storage e registro na tabela `generations`

### 2. ✅ Edge Function `generate-image` (Refatorada)
- Agora apenas enfileira o job e retorna imediatamente
- Resposta em < 1 segundo
- Dedução de créditos atômica

### 3. ✅ Frontend com Realtime + Polling
- Hook `useJobQueue` para gerenciar jobs pendentes
- Supabase Realtime para atualizações em tempo real
- Polling do worker a cada 3 segundos
- Estados visuais no SettingsNode (Na fila, Gerando)

---

## Arquitetura

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

## Benefícios Alcançados

| Antes (Síncrono) | Depois (Assíncrono) |
|------------------|---------------------|
| Timeout após 30-60s | Resposta em < 1s |
| Falha = perda total | Retry automático com backoff |
| Sem visibilidade | Jobs rastreáveis no banco |

