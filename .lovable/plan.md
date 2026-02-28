

## Plano: Reverter compressão desnecessária no MediaNode

A compressão client-side (Canvas resize para 2048px + JPEG 85%) foi adicionada como workaround para o limite de 4MB que já foi corrigido no backend (agora 20MB). Ela degrada a qualidade da imagem de referência que a IA recebe, sem necessidade.

### Alteração: `src/components/nodes/MediaNode.tsx`

1. **Remover** a função `compressImage` inteira (linhas 49-77)
2. **Reverter** o `handleFileSelect` para fazer upload do arquivo original sem compressão:
   - Usar a extensão original do arquivo (não forçar `.jpeg`)
   - Upload do `file` diretamente (não do `compressed`)
   - Remover o toast de compressão (manter apenas "Imagem enviada")
3. **Manter** a validação de 20MB e a rejeição de SVG (essas são úteis)

### Resultado
- Imagens de referência chegam ao Gemini na resolução e qualidade originais
- Validação de 20MB continua protegendo contra arquivos excessivos
- 1 arquivo alterado, sem deploy de edge function necessário

