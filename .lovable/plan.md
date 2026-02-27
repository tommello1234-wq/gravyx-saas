

## Problema atual: Memory limit exceeded mesmo com geração sequencial

Os logs mostram que o worker começa a processar (modelo correto `gemini-3-pro-image-preview`, 2 ref images), mas imediatamente dá "Memory limit exceeded". O problema é que baixar 2 imagens de referência e convertê-las para base64 inline já estoura o limite de memória da Edge Function.

### Causa raiz
A função `fetchImageAsBase64` baixa a imagem inteira para memória (`arrayBuffer`) e converte para base64 (que é ~33% maior). Com 2 imagens de referência grandes, isso ultrapassa o limite de ~150MB da Edge Function.

### Passos

1. **Limitar tamanho das imagens de referência** — Antes de enviar para a API, verificar o `Content-Length` da imagem. Se for maior que 4MB, pular essa referência. Adicionar log de tamanho.

2. **Processar referências uma a uma** — Em vez de carregar todas as imagens de referência na memória antes de chamar a API, processar e adicionar cada uma individualmente ao array de parts, liberando memória entre elas.

3. **Limitar a 1 imagem de referência** — Reduzir o limite de 3 para 1 imagem de referência para evitar estouro de memória. Se o usuário enviou múltiplas, usar apenas a primeira.

4. **Usar URL direta em vez de inline_data** — A API do Google suporta `file_data` com URI em vez de `inline_data` com base64. Investigar se podemos passar a URL pública diretamente para evitar download no worker. Se não for possível, manter o fallback com limite de tamanho.

5. **Limpar jobs travados** — Executar migration SQL para resetar os 2 jobs atuais (`598a177d...` e `aa0babad...`) para `failed`.

### Detalhe técnico

Mudanças no `image-worker/index.ts`:

- `fetchImageAsBase64`: Adicionar check de `Content-Length` (max 4MB), abort se exceder
- `generateSingleImage`: Limitar `imageUrls` a 1 referência
- Investigar uso de `file_data.file_uri` da API do Google como alternativa ao `inline_data`

SQL para cleanup:
```sql
UPDATE jobs 
SET status = 'failed', finished_at = now(), error = 'Memory limit exceeded'
WHERE id IN ('598a177d-df15-4a3f-a9f9-71e8dc42b77f', 'aa0babad-55d6-45e5-a37c-450fbd7a39c2');
```

