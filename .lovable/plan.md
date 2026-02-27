
Objetivo: restaurar o comportamento “prompt-driven” com 1–10 imagens de referência, sem exigir configuração manual de papéis por nó.

1) Ajustar coleta de referências no editor (ordem + metadados)
- Arquivo: `src/pages/Editor.tsx`
- Trocar coleta de mídias de `string[]` para `reference[]` com:
  - `url`
  - `label` (nome do nó de mídia)
  - `libraryPrompt` (quando existir)
  - `source` (`gravity` ou `result`)
  - `index` (ordem final enviada)
- Aplicar deduplicação por URL mantendo ordem estável.
- Continuar limitando a 10 referências no envio.

2) Enviar payload enriquecido para a fila
- Arquivo: `src/pages/Editor.tsx`
- Em `generateForResult`, manter `prompt` do usuário e enviar também:
  - `references: [{ url, label, libraryPrompt, index }]`
  - manter `imageUrls` por compatibilidade retroativa.
- Não alterar UX dos nós (continua “conectar prompt + mídias e gerar”).

3) Validar e normalizar novo payload na entrada da função
- Arquivo: `supabase/functions/generate-image/index.ts`
- Aceitar `references` (novo) + fallback para `imageUrls` (legado).
- Validar `references.length <= 10`, URLs HTTPS, tamanhos de strings seguras para `label/libraryPrompt`.
- Persistir `references` no `jobs.payload` para o worker usar a mesma ordem/metadados.

4) Melhorar montagem multimodal no worker (ponto principal)
- Arquivo: `supabase/functions/image-worker/index.ts`
- Ler `payload.references` (fallback para `payload.imageUrls`).
- Construir `parts` numerados:
  - texto de instrução curta de mapeamento (“Imagem 1..N”)
  - para cada referência: bloco de texto com índice + label/hint + `inline_data`.
- Incluir regra no texto do request para:
  - seguir menções do prompt (“imagem 1”, “imagem 2”, etc.)
  - inferir papel por conteúdo visual e label quando o prompt não numerar.
- Manter limite de 10 referências e logs claros da ordem final utilizada.

5) Robustez para Gemini 3.1 sem mudar UX
- Arquivo: `supabase/functions/image-worker/index.ts`
- Adicionar controle de tamanho agregado das referências (limite seguro abaixo do teto de request) e log de qualquer referência descartada por tamanho total.
- Se todas as referências forem descartadas, retornar erro explícito indicando que nenhuma referência válida foi enviada.

6) Verificação end-to-end após implementação
- Testar no fluxo real:
  - Prompt + 2 imagens (“base” + “rosto”) sem papéis manuais.
  - Prompt + 5 imagens.
  - Prompt + 10 imagens.
- Confirmar nos logs e na tabela `jobs`:
  - ordem final enviada
  - quantidade de referências realmente anexadas
  - ausência de fallback silencioso para apenas 1 imagem.

Seção técnica (resumo de impacto)
- Frontend: apenas enriquecimento de payload (sem mudanças visuais obrigatórias).
- Backend: compatível com jobs antigos; novo formato melhora interpretação de múltiplas imagens no Gemini 3.1.
- Banco: sem migração; apenas mudança no conteúdo JSON já existente em `jobs.payload`.
