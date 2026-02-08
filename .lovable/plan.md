

# Plano: Nova Arquitetura Gravity + Resultado

## Resumo das Mudanças

Reformulação da arquitetura de nodes para um sistema com **4 tipos de nodes**:

| Node | Função | Conexões |
|------|--------|----------|
| **Prompt** | Texto descritivo | Conecta ao Gravity OU ao Resultado |
| **Mídia** | Imagem de referência | Conecta ao Gravity OU ao Resultado |
| **Gravity** | Agregador (opcional) | Recebe Prompts/Mídias, envia para Resultados |
| **Resultado** | Configurações + Geração + Preview | Recebe de Gravity/Prompts/Mídias |

---

## Fluxos de Uso

**Fluxo Simples (sem Gravity):**
```text
Prompt ──┬──▶ RESULTADO ──▶ [Gerar]
Mídia  ──┘    (config + preview)
```

**Fluxo Organizado (com Gravity):**
```text
Prompt ──┐                     
         │                     ┌──▶ RESULTADO 1 ◀── Prompt extra
Prompt ──┼──▶ [GRAVITY] ───────┤
         │       ⚫             │
Mídia  ──┤  [Gerar Todos]      └──▶ RESULTADO 2 ◀── Prompt extra
         │
Mídia  ──┘
```

---

## Arquivos a Criar

### 1. `src/components/nodes/GravityNode.tsx` (Novo)

Node circular com a logo Gravyx no centro.

**Características:**
- Visual: Círculo com gradiente azul e logo no centro
- Handle esquerdo (entrada) e direito (saída)
- Ao clicar no círculo: abre popup para inputs internos
- Botão "Gerar Todos" abaixo do círculo
- Contador de Resultados conectados

**Dados do Node:**
```typescript
interface GravityNodeData {
  label: string;
  internalPrompt: string;        // Prompt digitado no popup
  internalMediaUrls: string[];   // Mídias upadas no popup
}
```

---

### 2. `src/components/nodes/GravityPopup.tsx` (Novo)

Modal que abre ao clicar no Gravity.

**Conteúdo:**
- Campo de texto para "Prompt Base"
- Área de upload de mídias (grid com botão +)
- Botão Salvar/Fechar

---

### 3. `src/components/nodes/ResultNode.tsx` (Novo)

Combina as funcionalidades de SettingsNode + OutputNode.

**Estrutura visual:**
```text
┌──────────────────────────────────────────┐
│  [🎨]  Resultado 1        [⋮]           │
│        4 imagens                         │
├──────────────────────────────────────────┤
│  Proporção: [1:1] [4:5] [9:16] [16:9]   │
│  Quantidade: [1] [2] [4]                 │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │img1│ │img2│ │img3│ │img4│            │
│  └────┘ └────┘ └────┘ └────┘            │
│                                          │
│   ╔══════════════════════════════════╗   │
│   ║     ✨ Gerar (X créditos)        ║   │
│   ╚══════════════════════════════════╝   │
│                                          │
└──────────────────────────────────────────┘
○ Handle esquerdo (entrada)
```

**Dados do Node:**
```typescript
interface ResultNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
  images: NodeImage[];
}
```

---

## Arquivos a Modificar

### 4. `src/pages/Editor.tsx`

**Mudanças:**
- Adicionar `gravity` e `result` aos `nodeTypes`
- Nova função `collectGravityContext()` para agregar prompts/mídias do Gravity
- Nova função `generateForResult()` para gerar em um Resultado específico
- Nova função `generateAllFromGravity()` para disparar todos os Resultados conectados
- Atualizar `addNode()` para criar novos tipos
- Manter compatibilidade com nodes antigos (settings/output)

**Nova lógica de geração:**
```text
Para cada Resultado:
1. Verificar se está conectado a um Gravity
2. Se sim: coletar contexto base (prompts + mídias do Gravity)
3. Coletar contexto local (prompts + mídias conectados direto ao Resultado)
4. Concatenar: prompt_final = prompts_gravity + prompts_locais
5. Concatenar: midias_final = midias_gravity + midias_locais
6. Usar configs do próprio Resultado (aspectRatio, quantity)
7. Chamar API de geração
```

---

### 5. `src/components/editor/NodeToolbar.tsx`

**Mudanças:**
- Substituir `settings` por `gravity`
- Substituir `output` por `result`
- Manter `prompt` e `media`

**Nova configuração:**
```typescript
const tools = [
  { type: 'prompt', icon: Type, label: 'Prompt', color: 'text-amber-500' },
  { type: 'media', icon: Image, label: 'Mídia', color: 'text-blue-500' },
  { type: 'gravity', icon: Orbit, label: 'Gravity', color: 'text-violet-500' },
  { type: 'result', icon: Sparkles, label: 'Resultado', color: 'text-emerald-500' },
];
```

---

## Detalhes Técnicos

### Eventos de Comunicação

| Evento | Origem | Destino | Payload |
|--------|--------|---------|---------|
| `GENERATE_FOR_RESULT` | ResultNode | Editor | `{ resultId: string }` |
| `GENERATE_ALL_FROM_GRAVITY` | GravityNode | Editor | `{ gravityId: string }` |
| `GENERATING_STATE_EVENT` | Editor | ResultNode | `{ resultId: string, isGenerating: boolean }` |

---

### Função de Agregação do Gravity

```typescript
function collectGravityContext(gravityId: string, nodes: Node[], edges: Edge[]) {
  const gravityNode = nodes.find(n => n.id === gravityId);
  if (!gravityNode) return { prompts: [], medias: [] };
  
  const gravityData = gravityNode.data as GravityNodeData;
  
  // Prompts conectados ao Gravity
  const inputEdges = edges.filter(e => e.target === gravityId);
  const connectedPrompts = inputEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'prompt'))
    .filter(Boolean)
    .map(n => (n.data as { value: string }).value)
    .filter(Boolean);
  
  // Mídias conectadas ao Gravity
  const connectedMedias = inputEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'media'))
    .filter(Boolean)
    .map(n => (n.data as { url: string | null }).url)
    .filter(Boolean) as string[];
  
  // Dados internos do Gravity
  const internalPrompt = gravityData.internalPrompt || '';
  const internalMedias = gravityData.internalMediaUrls || [];
  
  return {
    prompts: [...connectedPrompts, internalPrompt].filter(Boolean),
    medias: [...connectedMedias, ...internalMedias]
  };
}
```

---

### Função de Geração para um Resultado

```typescript
async function generateForResult(
  resultId: string, 
  gravityContext: { prompts: string[], medias: string[] } | null
) {
  const resultNode = nodes.find(n => n.id === resultId);
  if (!resultNode) return;
  
  const resultData = resultNode.data as ResultNodeData;
  
  // Coletar prompts locais (conectados direto ao Resultado)
  const localEdges = edges.filter(e => e.target === resultId);
  const localPrompts = localEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'prompt'))
    .filter(Boolean)
    .map(n => (n.data as { value: string }).value)
    .filter(Boolean);
  
  // Coletar mídias locais
  const localMedias = localEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'media'))
    .filter(Boolean)
    .map(n => (n.data as { url: string | null }).url)
    .filter(Boolean) as string[];
  
  // Montagem final - TUDO SOMA
  const allPrompts = [...(gravityContext?.prompts || []), ...localPrompts];
  const allMedias = [...(gravityContext?.medias || []), ...localMedias];
  
  const prompt = allPrompts.join(' ');
  const { aspectRatio, quantity } = resultData;
  
  // Chamar API...
}
```

---

## Migração e Compatibilidade

- Os nodes antigos (`settings`, `output`) continuarão funcionando
- Projetos existentes não serão afetados
- Usuários podem criar novos projetos com a nova arquitetura
- Futuramente: ferramenta de migração opcional

---

## Ordem de Implementação

| Fase | Descrição | Arquivos |
|------|-----------|----------|
| 1 | Criar ResultNode (merge Settings + Output) | `ResultNode.tsx` |
| 2 | Criar GravityNode básico | `GravityNode.tsx` |
| 3 | Criar GravityPopup | `GravityPopup.tsx` |
| 4 | Atualizar Editor.tsx | `Editor.tsx` |
| 5 | Atualizar NodeToolbar | `NodeToolbar.tsx` |
| 6 | Testes e ajustes | - |

---

## Avaliação de Complexidade

| Aspecto | Nível | Justificativa |
|---------|-------|---------------|
| ResultNode | Médio | Combinar Settings + Output existentes |
| GravityNode circular | Baixo | CSS customizado + logo |
| GravityPopup | Médio | Modal com upload de mídias |
| Lógica de agregação | Baixo | Concatenação simples |
| Gerar individual | Baixo | Similar ao atual |
| Gerar todos | Médio | Loop pelos Resultados conectados |

**Risco de alucinação:** BAIXO

A lógica é clara e sem ambiguidades:
- Tudo soma (nunca sobrescreve)
- Cada Resultado é autônomo
- Gravity apenas agrega e dispara

