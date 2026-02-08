

# Plano: Redesign do GravityNode

## Visão Geral

Vou redesenhar o GravityNode para corresponder exatamente ao visual minimalista da imagem de referência, mantendo todas as funcionalidades existentes.

## Design da Imagem de Referência

| Elemento | Descrição |
|----------|-----------|
| **Borda orbital** | Linha fina azul formando um arco circular (não fecha completamente - abre em cima e embaixo) |
| **Esfera central** | Gradiente vertical azul (ciano claro no topo → azul escuro embaixo) |
| **Handles laterais** | Duas esferas menores nas pontas do arco, mesmo gradiente azul |

## Paleta de Cores (Usando variáveis do sistema)

- **Primary (Cyan)**: `hsl(195 100% 50%)` - topo do gradiente
- **Secondary (Deep blue)**: `hsl(210 100% 50%)` - base do gradiente
- **Accent (Royal blue)**: `hsl(220 90% 56%)` - detalhes

---

## Mudanças no `src/components/nodes/GravityNode.tsx`

### 1. Remover o ícone gravyxIcon

Substituir a imagem central por uma esfera com gradiente azul puro (sem ícone interno).

### 2. Nova estrutura visual

```text
┌─────────────────────────────────────────┐
│                                         │
│       ╭───────────────────╮             │
│   ●  (         ●         )  ●           │
│ handle   arco   centro   arco  handle   │
│       ╰───────────────────╯             │
│                                         │
│              Gravity                    │
│          "n resultados"                 │
│        [Gerar Todos btn]                │
└─────────────────────────────────────────┘
```

### 3. Implementação técnica

**Esfera central:**
- Tamanho: ~80px (w-20 h-20)
- Gradiente: `from-cyan-400 via-blue-500 to-blue-700` (de cima para baixo)
- Sem borda, apenas o gradiente

**Arco orbital:**
- Usar SVG ou borda CSS com `border-radius: 50%`
- Linha fina (~2px) em ciano/azul
- Aberturas em cima e embaixo (usando `clip-path` ou SVG)

**Handles:**
- Tamanho aumentado: ~24px (w-6 h-6)
- Mesmo gradiente azul da esfera central
- Sem borda/stroke, apenas gradiente sólido
- Posicionados exatamente nas laterais do arco

### 4. Remover elementos desnecessários

- Remover o uso do `gravyxIcon`
- Remover bordas violeta/roxas atuais
- Remover o botão de menu (três pontinhos) do círculo — mover para o label area ou manter oculto até hover

### 5. Manter funcionalidades

- Clique na esfera central abre o popup
- Handles funcionais para conexões
- Label editável abaixo
- Botão "Gerar Todos" quando há resultados conectados
- Dropdown menu (reposicionado)

---

## Código da Nova Estrutura Visual

```tsx
{/* Orbital Ring (arco) */}
<div className="absolute inset-0">
  <svg 
    viewBox="0 0 160 160" 
    className="w-full h-full"
  >
    {/* Arco superior */}
    <path
      d="M 16 80 A 64 64 0 0 1 144 80"
      fill="none"
      stroke="url(#orbital-gradient)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Arco inferior */}
    <path
      d="M 144 80 A 64 64 0 0 1 16 80"
      fill="none"
      stroke="url(#orbital-gradient)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient id="orbital-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(210 100% 50%)" />
        <stop offset="50%" stopColor="hsl(195 100% 50%)" />
        <stop offset="100%" stopColor="hsl(210 100% 50%)" />
      </linearGradient>
    </defs>
  </svg>
</div>

{/* Central Sphere */}
<div 
  className="w-20 h-20 rounded-full cursor-pointer transition-all duration-300
             bg-gradient-to-b from-cyan-400 via-blue-500 to-blue-700
             shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70"
  onClick={() => setIsPopupOpen(true)}
/>

{/* Handles com gradiente */}
<Handle 
  type="target" 
  position={Position.Left} 
  className="!w-6 !h-6 !bg-gradient-to-b !from-cyan-400 !to-blue-600 
             !border-0 !-left-3 !shadow-lg !shadow-blue-500/50" 
/>
<Handle 
  type="source" 
  position={Position.Right} 
  className="!w-6 !h-6 !bg-gradient-to-b !from-cyan-400 !to-blue-600 
             !border-0 !-right-3 !shadow-lg !shadow-blue-500/50" 
/>
```

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/nodes/GravityNode.tsx` | Redesign completo do visual do node |

---

## Resultado Esperado

- Design minimalista e elegante igual à imagem de referência
- Esfera central azul com gradiente (sem ícone)
- Arco orbital fino em azul
- Handles laterais maiores com mesmo gradiente
- Todas as funcionalidades mantidas (popup, conexões, geração em lote)
- Alinhado com a identidade visual "Blue Orbital" do projeto

