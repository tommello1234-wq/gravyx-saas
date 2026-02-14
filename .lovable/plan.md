

## Correção: Imagens Duplicadas no Nó de Resultado

### Problema Identificado

Existem **dois mecanismos** que adicionam imagens ao nó de resultado, e eles podem correr em paralelo causando duplicação:

1. **`handleJobCompleted`** (Editor.tsx, linha 274): Quando um job termina, ele **ADICIONA** (append) as novas URLs ao array de imagens do nó.
2. **Polling fallback** (Editor.tsx, linha 897): A cada 5 segundos, ele lê TODAS as imagens do banco de dados e **SUBSTITUI** o array inteiro do nó.

A corrida acontece assim:
1. O worker salva as imagens no banco e marca o job como `completed`
2. O polling fallback dispara, lê o banco (que já tem as novas imagens), e substitui o array do nó com [A, B, C, D]
3. Logo em seguida, o Realtime dispara o `handleJobCompleted`, que faz append de [C, D] nas imagens que ja estao no nó
4. Resultado: o nó fica com [A, B, C, D, C, D] -- as duas novas imagens aparecem duplicadas

Ao recarregar a página, só o carregamento inicial do banco roda, e mostra os dados corretos.

### Solucao

Adicionar **deduplicação por URL** no `handleJobCompleted`. Antes de fazer append, filtrar as URLs que já existem no array de imagens do nó. Isso garante que mesmo que o polling fallback já tenha adicionado as imagens, o callback não as duplique.

### Detalhes Tecnicos

**Arquivo**: `src/pages/Editor.tsx`

Na funcao `handleJobCompleted` (por volta da linha 274-288), alterar a logica de append para:

1. Ler as imagens existentes do nó (`existingImages`)
2. Criar um `Set` com as URLs existentes
3. Filtrar `newImages` removendo qualquer imagem cuja URL ja exista no Set
4. Fazer append apenas das imagens realmente novas

```text
Antes:
  images: [...existingImages, ...newImages]

Depois:
  const existingUrls = new Set(existingImages.map(img => typeof img === 'string' ? img : img.url));
  const uniqueNewImages = newImages.filter(img => !existingUrls.has(img.url));
  images: [...existingImages, ...uniqueNewImages]
```

Essa alteracao e minima (3 linhas) e resolve o problema na raiz sem afetar nenhum outro fluxo.

