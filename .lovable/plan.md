

## Plano: Incluir nomes dos nodes como contexto para o Gemini

### O que muda
Enviar os nomes (labels) dos Media Nodes junto com as imagens, para que o usuário possa referenciar nodes pelo nome no prompt.

### Alterações

**1. `src/pages/Editor.tsx`**
- Nas funções `collectGravityContext` e `collectLocalContext`, incluir o label do Media Node no objeto `reference`: `{ url, index, label }`
- O label já está disponível no node data (`node.data.label`)

**2. `supabase/functions/generate-image/index.ts`**
- Aceitar `label` no mapeamento de references: `{ url, index, label }`

**3. `supabase/functions/image-worker/index.ts`**
- Antes de cada `file_data` part, inserir um `text` part com o nome: `{ text: "[Imagem: Logo]" }`
- Resultado final para o Gemini:
```
parts: [
  { text: "Use a imagem Logo como marca d'água..." },
  { text: "[Imagem: Logo]" },
  { file_data: { file_uri, mime_type } },
  { text: "[Imagem: Fundo]" },
  { file_data: { file_uri, mime_type } }
]
```

### Resultado
O usuário pode referenciar nodes pelo nome no prompt e o Gemini entende qual imagem é qual.

