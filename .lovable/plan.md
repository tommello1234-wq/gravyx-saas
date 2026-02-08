
# Plano: Corrigir Nodes no Template Editor

## Problema Identificado

O **Template Editor** (`src/pages/TemplateEditor.tsx`) está com incompatibilidade entre:

1. **NodeToolbar** oferece: `prompt`, `media`, `gravity`, `result`
2. **nodeTypes registrados** no Template Editor: `prompt`, `media`, `settings`, `output`

Quando você clica em "Gravity" ou "Resultado" na toolbar:
- O sistema cria um node com `type: 'gravity'` ou `type: 'result'`
- O React Flow procura em `nodeTypes` mas não encontra esses tipos
- O node fica "invisível" ou com comportamento bugado

Além disso, a função `addNode` no Template Editor não trata os casos `gravity` e `result` - só trata `prompt`, `media`, `settings` e `output`.

---

## Solução

Sincronizar o Template Editor com o Editor principal para suportar os mesmos tipos de nodes.

### Mudanças no `src/pages/TemplateEditor.tsx`:

#### 1. Importar os componentes faltantes

```typescript
import { ResultNode } from '@/components/nodes/ResultNode';
import { GravityNode } from '@/components/nodes/GravityNode';
```

#### 2. Atualizar `nodeTypes` para incluir todos os tipos

```typescript
const nodeTypes = {
  prompt: PromptNode,
  media: MediaNode,
  settings: SettingsNode,
  output: OutputNode,
  result: ResultNode,   // ← Adicionar
  gravity: GravityNode  // ← Adicionar
};
```

#### 3. Atualizar a função `addNode` para tratar os novos tipos

Adicionar os cases faltantes no switch:

```typescript
case 'result':
  data = { 
    label: 'Resultado', 
    aspectRatio: '1:1', 
    quantity: 1, 
    images: [] 
  };
  break;
case 'gravity':
  data = { 
    label: 'Gravity', 
    internalPrompt: '', 
    internalMediaUrls: [] 
  };
  break;
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/TemplateEditor.tsx` | Importar `ResultNode` e `GravityNode`, adicionar em `nodeTypes`, e atualizar `addNode` |

---

## Resultado Esperado

Após a correção:
- Ao clicar em "Gravity" ou "Resultado" na toolbar do Template Editor, o node aparecerá corretamente
- Ao editar um template existente que contém esses tipos, eles renderizarão normalmente
- Templates criados funcionarão corretamente ao serem clonados para novos projetos

---

## Detalhes Técnicos

O Template Editor é essencialmente uma versão simplificada do Editor principal, voltada para admins criarem layouts base. A incompatibilidade surgiu porque a `NodeToolbar` foi atualizada para usar os tipos modernos (`result`, `gravity`) enquanto o Template Editor ainda referenciava os tipos antigos (`output`, `settings`).

A solução mantém compatibilidade total - os tipos `output` e `settings` continuam funcionando para templates antigos, enquanto os novos tipos `result` e `gravity` agora estão disponíveis.
