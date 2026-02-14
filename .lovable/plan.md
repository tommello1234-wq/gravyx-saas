
# Corrigir Bug Critico de Creditos Duplicados

## O problema

O fluxo atual debita creditos ANTES de gerar e reembolsa em caso de erro. Isso causa reembolsos duplicados:

1. `generate-image` debita creditos na hora
2. `image-worker` tenta gerar, falha, reembolsa os creditos (linha 235-238)
3. Como todas falharam, faz `throw` que cai no catch
4. O catch agenda um retry -- mas os creditos JA foram reembolsados
5. No retry, falha de novo, reembolsa DE NOVO
6. No ultimo retry, o catch reembolsa TUDO mais uma vez

Com 3 retries e 1 imagem: usuario paga 1 credito mas recebe 4 de volta. Isso explica a Taiane com 59 creditos em vez de 25, e o Caio com 50 apos gerar 16.

## A solucao

Inverter a logica: NAO debitar creditos antecipadamente. Debitar somente APOS a imagem ser gerada com sucesso. Sem debito antecipado = sem necessidade de reembolso = sem risco de creditos fantasma.

## Alteracoes

### 1. `supabase/functions/generate-image/index.ts`
- REMOVER a deducao de creditos antecipada (remover chamada a `decrement_credits`)
- MANTER a verificacao de saldo (checar se tem creditos suficientes antes de enfileirar)
- Retornar o job normalmente sem debitar nada
- Remover a logica de refund em caso de falha ao inserir o job

### 2. `supabase/functions/image-worker/index.ts`
- APOS gerar cada imagem com sucesso, debitar 1 credito via `decrement_credits`
- Se o debito falhar (saldo insuficiente durante o processamento), nao salvar a imagem
- REMOVER toda logica de reembolso (linhas 234-238 e 327-330) -- nao ha mais o que reembolsar
- REMOVER o reembolso no catch de max retries -- creditos nunca foram debitados
- Manter retries para erros de geracao (rede, API), mas sem mexer em creditos

### 3. Fluxo novo simplificado

```text
Usuario clica "Gerar"
        |
        v
generate-image: Verifica saldo >= quantidade necessaria
        |
        v
Insere job na fila (creditos NAO debitados)
        |
        v
image-worker: Gera imagem via AI
        |
   Sucesso?
   /       \
 Sim       Nao
  |          |
  v          v
Debita 1   Nao faz nada
credito    (retry sem mexer em creditos)
  |
  v
Salva imagem no banco
```

## Detalhes tecnicos

- A verificacao de saldo em `generate-image` continua existindo como "guarda" para nao enfileirar jobs sem chance de sucesso
- O debito atomico no worker usa `decrement_credits` que ja tem protecao contra saldo negativo
- Se entre o enfileiramento e o processamento o usuario gastar creditos de outra forma, o `decrement_credits` vai falhar com "Insufficient credits" e a imagem simplesmente nao sera entregue (comportamento correto)
- Nenhuma alteracao de banco de dados necessaria -- as funcoes `decrement_credits` e `increment_credits` ja existem
- O frontend (`useJobQueue`) nao precisa de alteracao -- ele ja lida com jobs completados/falhados
