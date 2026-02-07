
# Plano: Correção da Tela Preta

## Problema Identificado

Usuários reportaram que a tela fica preta (e a aplicação "crasha") em dois cenários:

1. **Ao criar um projeto e clicar em "Criar"** - A navegação para o Editor falha silenciosamente
2. **Ao clicar em "Gerar" no canvas** - A geração de imagem causa um crash silencioso

Como a aplicação usa um tema dark (`--background: 240 10% 4%`), quando o React crasha, o fundo escuro aparece como "tela preta".

## Causa Raiz

### 1. Ausência de Error Boundary
Não existe um Error Boundary na aplicação. Quando ocorre qualquer erro não tratado no React, a árvore de componentes é desmontada e o usuário vê apenas o fundo escuro.

### 2. Problemas de serialização no auto-save
No `Editor.tsx`, a função `saveProject` usa `JSON.parse(JSON.stringify({...}))` que pode falhar se os dados contiverem:
- Funções
- Referências circulares
- Valores `undefined` (são removidos)

### 3. Uso incorreto do ReactFlowProvider
Embora os nós sejam renderizados dentro do `<ReactFlow>`, não há um `<ReactFlowProvider>` envolvendo o componente. Isso pode causar problemas de sincronização de estado durante atualizações rápidas.

## Correções Necessárias

### 1. Criar Error Boundary Global

Componente que captura erros e mostra UI amigável em vez de tela preta:

```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1>Algo deu errado</h1>
            <button onClick={() => window.location.reload()}>
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 2. Envolver Editor com ReactFlowProvider

O componente `<ReactFlow>` precisa estar dentro de um `<ReactFlowProvider>` quando usamos hooks como `useReactFlow()` em componentes separados:

```typescript
// Editor.tsx
import { ReactFlowProvider } from '@xyflow/react';

export default function Editor() {
  return (
    <ReactFlowProvider>
      <EditorCanvas />
    </ReactFlowProvider>
  );
}
```

### 3. Adicionar tratamento de erro na serialização

Proteger o `JSON.parse(JSON.stringify())` com try-catch:

```typescript
const saveProject = async (...) => {
  try {
    const canvasData = JSON.parse(JSON.stringify({ nodes, edges }));
    // ... resto do save
  } catch (err) {
    console.error('Serialization error:', err);
    toast({ title: 'Erro ao salvar', variant: 'destructive' });
  }
};
```

### 4. Aplicar mesma correção no TemplateEditor

O `TemplateEditor.tsx` tem a mesma estrutura e precisa das mesmas correções.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ErrorBoundary.tsx` | **NOVO** - Componente Error Boundary global |
| `src/App.tsx` | Envolver aplicação com ErrorBoundary |
| `src/pages/Editor.tsx` | Adicionar ReactFlowProvider e melhorar tratamento de erros |
| `src/pages/TemplateEditor.tsx` | Adicionar ReactFlowProvider e melhorar tratamento de erros |

## Resultado Esperado

Após as correções:

1. Se ocorrer qualquer erro, o usuário verá uma mensagem amigável com botão de recarregar
2. O Editor será mais estável com o ReactFlowProvider corretamente configurado
3. Erros de serialização serão capturados e reportados ao usuário
4. A tela preta não acontecerá mais - haverá sempre feedback visual

## Detalhes Técnicos

A estrutura do Editor ficará assim:

```text
Editor (função exportada)
└── ReactFlowProvider
    └── EditorCanvas (componente interno)
        └── ReactFlow
            ├── PromptNode (usa useReactFlow)
            ├── MediaNode (usa useReactFlow)
            ├── SettingsNode (usa useReactFlow)
            └── OutputNode (usa useReactFlow)
```

E a estrutura do App:

```text
App
└── ErrorBoundary
    └── QueryClientProvider
        └── AuthProvider
            └── TooltipProvider
                └── BrowserRouter
                    └── Routes
```
