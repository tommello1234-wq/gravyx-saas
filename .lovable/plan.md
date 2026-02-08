
# Plano: Modal de Confirmação no Gravity Node

## Objetivo

Adicionar um modal de confirmação quando o usuário clicar em "Gerar Todos" no Gravity Node, mostrando quantas imagens serão geradas e quantos créditos serão gastos.

---

## Comportamento Esperado

Ao clicar em "Gerar Todos":

1. O sistema calcula o total de imagens baseado nos Result Nodes conectados
2. Exibe um AlertDialog com a mensagem:
   > "Você tem certeza que deseja gerar?"
   > "Você vai gerar **X imagens** e gastará **X créditos**."
3. Botões: "Cancelar" e "Confirmar"
4. Ao confirmar, dispara o evento `GENERATE_ALL_FROM_GRAVITY_EVENT`

---

## Mudanças Necessárias

### Arquivo: `src/components/nodes/GravityNode.tsx`

**Novos imports:**
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

**Novo estado:**
```typescript
const [isConfirmOpen, setIsConfirmOpen] = useState(false);
const [totalImages, setTotalImages] = useState(0);
```

**Nova função para calcular total:**
```typescript
const calculateTotalImages = useCallback(() => {
  const edges = getEdges();
  const nodes = getNodes();
  const outputEdges = edges.filter(e => e.source === id);
  
  let total = 0;
  for (const edge of outputEdges) {
    const targetNode = nodes.find(n => n.id === edge.target);
    if (targetNode?.type === 'result') {
      const resultData = targetNode.data as ResultNodeData;
      total += resultData.quantity || 1;
    }
  }
  return total;
}, [id, getEdges, getNodes]);
```

**Modificar `handleGenerateAll`:**
```typescript
// ANTES: Dispara direto
const handleGenerateAll = () => {
  window.dispatchEvent(new CustomEvent(GENERATE_ALL_FROM_GRAVITY_EVENT, { 
    detail: { gravityId: id } 
  }));
};

// DEPOIS: Abre modal de confirmação
const handleGenerateAllClick = () => {
  const total = calculateTotalImages();
  setTotalImages(total);
  setIsConfirmOpen(true);
};

const handleConfirmGenerate = () => {
  setIsConfirmOpen(false);
  window.dispatchEvent(new CustomEvent(GENERATE_ALL_FROM_GRAVITY_EVENT, { 
    detail: { gravityId: id } 
  }));
};
```

**Adicionar AlertDialog no JSX:**
```tsx
<AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirmar geração</AlertDialogTitle>
      <AlertDialogDescription>
        Você vai gerar <strong>{totalImages} {totalImages === 1 ? 'imagem' : 'imagens'}</strong> e 
        gastará <strong>{totalImages} {totalImages === 1 ? 'crédito' : 'créditos'}</strong>.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmGenerate}>
        Confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Atualizar o onClick do botão:**
```tsx
// ANTES
onClick={handleGenerateAll}

// DEPOIS
onClick={handleGenerateAllClick}
```

---

## Estrutura Visual do Modal

```text
┌─────────────────────────────────────────────┐
│  Confirmar geração                      [X] │
├─────────────────────────────────────────────┤
│                                             │
│  Você vai gerar 20 imagens e gastará        │
│  20 créditos.                               │
│                                             │
├─────────────────────────────────────────────┤
│                    [Cancelar]  [Confirmar]  │
└─────────────────────────────────────────────┘
```

---

## Import Necessário para ResultNodeData

Para acessar o tipo `ResultNodeData` e obter a `quantity`:

```typescript
import { ResultNodeData } from './ResultNode';
```

---

## Resumo

| Aspecto | Detalhe |
|---------|---------|
| Arquivo modificado | `src/components/nodes/GravityNode.tsx` |
| Novo componente usado | `AlertDialog` (já existe em ui/) |
| Cálculo | Soma de `quantity` de cada Result Node conectado |
| UX | Modal aparece antes de disparar geração |
| Custo | 1 crédito por imagem (já definido no sistema) |

