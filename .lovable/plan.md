

## Mensagem amigavel para falha na geracao + remover fallback

### O que muda

1. **Remover modelo fallback** do `image-worker` -- usar apenas `google/gemini-3-pro-image-preview`
2. **Mensagem amigavel** quando a API do Google retorna erro 500, em vez de "All image generations failed"
3. **Traduzir mensagem no frontend** para garantir que o toast mostre texto amigavel

### Detalhes tecnicos

#### Arquivo: `supabase/functions/image-worker/index.ts`

- Remover o array `IMAGE_MODELS` e o loop de fallback
- Voltar a usar apenas `google/gemini-3-pro-image-preview`
- Quando a API retornar status 500, definir a mensagem de erro como: `"Estamos enfrentando uma instabilidade temporária nos servidores da API do Google. Aguarde um instante e tente novamente mais tarde."`
- Essa mensagem sera salva no campo `error` do job, que e exibida no toast do frontend

#### Arquivo: `src/pages/Editor.tsx`

- Nenhuma mudanca necessaria -- o `handleJobFailed` ja exibe `error` como `description` do toast, entao a mensagem amigavel do worker vai aparecer automaticamente

### Resultado

Quando o Google retornar erro 500, o usuario vera no toast:

> **Falha na geracao**
> Estamos enfrentando uma instabilidade temporaria nos servidores da API do Google. Aguarde um instante e tente novamente mais tarde.

Em vez de:

> **Falha na geracao**
> All image generations failed

