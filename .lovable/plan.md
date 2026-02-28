

## Diagnóstico

O label dos nós (ex: "Foto dos produtos", "Imagem de referencia") **é coletado** no Editor.tsx e enviado ao backend no array `references`, mas no `image-worker/index.ts` (linha 160) ele é **descartado** — as imagens são adicionadas ao prompt sem nenhuma identificação textual. O modelo recebe as imagens "cegas", sem saber qual é qual.

## Correção

**Arquivo:** `supabase/functions/image-worker/index.ts` (linhas 160-177)

Adicionar um label textual curto antes de cada imagem de referência, usando o nome do nó definido pelo usuário. Isso permite que o prompt diga "use a imagem do node de Imagem de referencia somente como referencia" e o modelo saiba exatamente a qual imagem se refere.

### Implementação

Alterar o loop de referências (linha 160-177) para inserir um `text` part com o label antes de cada `inline_data`:

```typescript
// Add reference images with labels from node names
for (let i = 0; i < refUrls.length; i++) {
  const url = refUrls[i];
  
  // Add label if available from enriched references
  if (useEnrichedRefs && references[i]?.label) {
    parts.push({ text: `[Image: ${references[i].label}]` });
  }
  
  if (url.startsWith("data:")) {
    // ... existing base64 handling
  } else {
    // ... existing URL fetch handling
  }
}
```

Dessa forma, quando o usuário renomeia um nó para "Imagem de referencia" e outro para "Foto dos produtos", o modelo Gemini recebe:

```
[Image: Foto dos produtos]
<inline_data>
[Image: Imagem de referencia]
<inline_data>
```

E o prompt "use a imagem do node de Imagem de referencia somente como referencia" faz sentido para o modelo.

### Impacto
- 1 arquivo alterado: `supabase/functions/image-worker/index.ts`
- Deploy da Edge Function necessário
- Sem breaking changes — nós sem label customizado receberão o default "Mídia"

