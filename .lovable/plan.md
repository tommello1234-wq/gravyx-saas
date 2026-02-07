
# Plano: Otimização para Reduzir Requisições ao Banco de Dados

## Objetivo

Reduzir as requisições ao banco de ~1,300/hora para ~50-100/hora sem afetar a experiência do usuário.

## Mudanças a Implementar

### 1. Editor.tsx - Otimizar Auto-save

| Mudança | Antes | Depois |
|---------|-------|--------|
| Debounce do auto-save | 1.5s | 3s |
| Verificação de mudanças | Não tinha | Compara JSON antes de salvar |
| Dependências do `saveProject` | Incluía `toast` (instável) | Usa ref para `toast` |

**Código principal:**
```typescript
// Ref para evitar salvamentos redundantes
const lastSavedDataRef = useRef<string>('');

// Verificar se dados mudaram antes de salvar
const dataString = JSON.stringify({ nodes: cleanNodes, edges: edgesToSave });
if (dataString === lastSavedDataRef.current) {
  return; // Dados iguais - não salvar
}
lastSavedDataRef.current = dataString;
```

### 2. PromptNode.tsx - Debounce na Digitação

O principal vilão é o campo de texto. Cada tecla pressionada dispara uma atualização.

**Solução:** Manter estado local imediato (UI responsiva) mas atualizar o flow global apenas após 500ms de inatividade:

```typescript
const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handleValueChange = useCallback((newValue: string) => {
  setValue(newValue); // UI instantânea
  
  // Debounce para atualizar o flow
  if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
  updateTimeoutRef.current = setTimeout(() => {
    setNodes((nodes) => nodes.map(...));
  }, 500);
}, [id, setNodes]);
```

### 3. MediaNode e SettingsNode

Não precisam de debounce adicional porque:
- **MediaNode**: Upload de imagem é evento único
- **SettingsNode**: Cliques em botões são discretos

## O Que Muda Para o Usuário

| Aspecto | Experiência |
|---------|-------------|
| Digitação | Continua instantânea (estado local) |
| Salvamento | "Salvando..." aparece menos frequentemente |
| Confiabilidade | Banco não vai mais cair por sobrecarga |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Editor.tsx` | Aumentar debounce, adicionar verificação de mudanças, estabilizar dependências |
| `src/components/nodes/PromptNode.tsx` | Adicionar debounce de 500ms na atualização do flow |

## Resultado Esperado

- **Redução de 90-95%** nas requisições ao banco de dados
- **Zero impacto** na experiência de digitação do usuário
- **Banco de dados estável** mesmo com múltiplos usuários
