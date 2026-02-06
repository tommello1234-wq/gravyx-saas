
# Correção: Timeout na Geração de Múltiplas Imagens

## O Problema

A Edge Function processa imagens **sequencialmente** (uma por uma). Cada chamada à API Gemini leva 15-30 segundos:

| Quantidade | Tempo Sequencial | Timeout (60s) |
|------------|------------------|---------------|
| 1 imagem   | 15-30s           | OK            |
| 2 imagens  | 30-60s           | No limite     |
| 3 imagens  | 45-90s           | TIMEOUT       |
| 4 imagens  | 60-120s          | TIMEOUT       |

## A Solução

Usar **`Promise.all()`** para processar todas as imagens **em paralelo**:

| Quantidade | Tempo Paralelo | Timeout (60s) |
|------------|----------------|---------------|
| 1-4 imagens | 15-30s        | OK            |

## Mudança Técnica

**Arquivo**: `supabase/functions/generate-image/index.ts`

```typescript
// ANTES: Loop sequencial (lento)
for (let i = 0; i < quantity; i++) {
  const response = await fetch(...);  // Espera cada um terminar
  // ...
}

// DEPOIS: Processamento paralelo (rápido)
const generateOne = async () => {
  const response = await fetch(...);
  // ...
  return imageUrl;
};

const promises = Array.from({ length: quantity }, () => generateOne());
const results = await Promise.all(promises);
const images = results.filter(Boolean);
```

## Detalhes da Implementação

1. Criar função `generateSingleImage()` que faz uma única chamada à API
2. Criar array de Promises para todas as imagens
3. Usar `Promise.all()` para executar todas simultaneamente
4. Filtrar resultados válidos
5. Salvar todas as gerações no banco

## Benefício

- **4 imagens em ~20 segundos** ao invés de ~80 segundos
- Elimina os erros 504 de timeout
- Experiência muito mais rápida para o usuário
