
# Correção: Suporte a Múltiplas Imagens de Mídia

## Problema

O sistema está ignorando imagens adicionais conectadas. Atualmente:
- **Editor.tsx (linha 210-212)**: Só pega `mediaNodes[0]` - a primeira imagem
- **Edge Function (linha 98-103)**: Só adiciona uma única `referenceUrl`

## Solução Simples

Como você já explica no prompt o que é cada imagem, a correção é apenas:

1. Coletar **todas** as URLs das imagens conectadas
2. Enviar como array para a Edge Function
3. Anexar **todas** as imagens ao request da IA

## Mudanças

### 1. Editor.tsx - Coletar todas as imagens

```typescript
// ANTES (só primeira)
const referenceUrl = mediaNodes[0]?.data.url;

// DEPOIS (todas)
const imageUrls = mediaNodes
  .map(n => (n.data as { url: string | null }).url)
  .filter(Boolean) as string[];
```

Enviar `imageUrls` (array) ao invés de `referenceUrl` (string).

### 2. Edge Function - Anexar todas as imagens

```typescript
// ANTES (uma imagem)
if (referenceUrl) {
  messageContent.push({ type: "image_url", image_url: { url: referenceUrl } });
}

// DEPOIS (todas as imagens)
for (const url of imageUrls) {
  messageContent.push({ type: "image_url", image_url: { url } });
}
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Editor.tsx` | Coletar array de URLs e enviar `imageUrls` |
| `supabase/functions/generate-image/index.ts` | Receber array e anexar todas ao request |

## Resultado

Conectando 3 nós de mídia + prompt explicando cada um, a IA receberá:
- O texto do prompt (você explicando o que é cada coisa)
- Todas as 3 imagens anexadas

A IA seguirá suas instruções do prompt para usar cada imagem corretamente.
