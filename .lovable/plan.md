# Plano: Renomear Nodes, Reset e Copy/Paste com Conexões

## ✅ IMPLEMENTADO

### Funcionalidades Adicionadas:

1. **Renomear nodes** - Ícone de lápis (✏️) para editar o nome/label do node
   - Input inline que aparece no lugar do título ao clicar
   - Enter ou blur confirma, Escape cancela

2. **Resetar node** - Ícone de reset (🔄) para limpar conteúdo e remover conexões
   - Prompt: limpa texto
   - Media: remove imagem e prompt
   - Settings: volta para 1:1 e 1 imagem
   - Output: limpa todas as imagens

3. **Copy/Paste nativo (Ctrl+C/Ctrl+V)** - Copia nodes com dados e conexões
   - Mantém todos os dados (value, url, images, etc.)
   - Recria edges com IDs únicos
   - Posiciona com offset de +50px

4. **Múltiplos nodes de Settings/Output permitidos** - Removida restrição de 1 por projeto

### Ícones Removidos:
- Botões de Copy (duplicar) e Trash (apagar) - substituídos por atalhos de teclado

### Arquivos Modificados:
- `src/pages/Editor.tsx` - Copy/paste system + removida restrição de nodes únicos
- `src/components/nodes/PromptNode.tsx` - Rename/reset
- `src/components/nodes/MediaNode.tsx` - Rename/reset
- `src/components/nodes/SettingsNode.tsx` - Rename/reset
- `src/components/nodes/OutputNode.tsx` - Rename/reset
