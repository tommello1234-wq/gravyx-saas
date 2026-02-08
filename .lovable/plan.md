
# Redesign do Gravity Node - Estilo Orbital Azul

## Visão Geral

Redesenhar o GravityNode para seguir a identidade visual "Blue Orbital" do site, removendo elementos roxos e aplicando o gradiente azul do design system.

---

## Mudanças Visuais

### Antes → Depois

| Elemento | Atual | Novo |
|----------|-------|------|
| Fundo do círculo | Gradiente violeta/roxo | Cor do background (`--background`) |
| Borda/Stroke | Violeta com opacidade | Gradiente azul (`cyan → blue → accent`) com glow |
| Centro | Logo gravyx-icon.png | Vazio por padrão, ícone "+" no hover |
| Texto abaixo | "Clique para editar" | Apenas label + contagem de resultados |
| Handles | Gradiente roxo | Gradiente azul |
| Botão Gerar | Gradiente roxo | Gradiente azul |
| Glow/Shadow | Violeta | Cyan/azul |

---

## Arquivo a Modificar

**`src/components/nodes/GravityNode.tsx`**

### 1. Remover import da logo

```typescript
// REMOVER esta linha:
import gravyxIcon from '@/assets/gravyx-icon.png';

// ADICIONAR import do ícone Plus:
import { Plus } from 'lucide-react';
```

### 2. Adicionar estado de hover

```typescript
const [isHovered, setIsHovered] = useState(false);
```

### 3. Redesenhar o círculo principal

De:
```tsx
<div className={cn(
  "w-24 h-24 rounded-full cursor-pointer transition-all duration-300",
  "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700",
  "border-4 border-violet-400/30 shadow-2xl shadow-violet-500/40",
  ...
)}>
  <img src={gravyxIcon} ... />
</div>
```

Para:
```tsx
<div 
  className={cn(
    "w-24 h-24 rounded-full cursor-pointer transition-all duration-300",
    "bg-background",
    "flex items-center justify-center",
    "hover:scale-105 group",
    hasContent && "ring-2 ring-primary ring-offset-2 ring-offset-card"
  )}
  style={{
    border: '3px solid transparent',
    backgroundImage: `
      linear-gradient(hsl(var(--background)), hsl(var(--background))),
      linear-gradient(135deg, hsl(var(--gradient-start)), hsl(var(--gradient-mid)), hsl(var(--gradient-end)))
    `,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    boxShadow: '0 0 20px hsl(195 100% 50% / 0.3), 0 0 40px hsl(210 100% 50% / 0.2)'
  }}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  onClick={() => setIsPopupOpen(true)}
>
  {/* Ícone "+" aparece no hover */}
  <Plus className={cn(
    "w-8 h-8 transition-all duration-200",
    isHovered ? "text-primary opacity-100 scale-100" : "text-muted-foreground/50 opacity-0 scale-75"
  )} />
</div>
```

### 4. Atualizar Handles para gradiente azul

De:
```tsx
className="!bg-gradient-to-br !from-violet-500 !to-purple-600 ..."
```

Para:
```tsx
className="!bg-gradient-to-br !from-primary !to-secondary ..."
```

### 5. Remover texto "Clique para editar"

De:
```tsx
<p className="text-xs text-muted-foreground">
  {resultCount > 0 ? `${resultCount} resultado${resultCount > 1 ? 's' : ''}` : 'Clique para editar'}
</p>
```

Para:
```tsx
{resultCount > 0 && (
  <p className="text-xs text-muted-foreground">
    {resultCount} resultado{resultCount > 1 ? 's' : ''}
  </p>
)}
```

### 6. Atualizar botão "Gerar Todos"

De:
```tsx
"bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
"shadow-violet-500/30 hover:shadow-violet-500/50"
```

Para:
```tsx
"bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90",
"shadow-primary/30 hover:shadow-primary/50"
```

---

## Resultado Visual Esperado

```text
                    ┌───┐ (menu)
                    └───┘
      ╭─────────────────────────────╮
      │                             │
  ◉───│           (+)               │───◉
      │                             │
      ╰─────────────────────────────╯
         ↑ gradiente azul + glow
         
              Gravity
           2 resultados

        ┌────────────────┐
        │  ✨ Gerar Todos │  ← gradiente azul
        └────────────────┘
```

- Círculo com fundo escuro (igual ao canvas)
- Borda com gradiente cyan → blue → accent
- Glow azul suave ao redor
- Ícone "+" aparece ao passar o mouse
- Quando tem conteúdo, ring azul indica que há dados

---

## Seção Técnica

### CSS Variables utilizadas
- `--background`: HSL 220 20% 4% (fundo escuro)
- `--gradient-start`: HSL 195 100% 50% (cyan)
- `--gradient-mid`: HSL 210 100% 50% (deep blue)
- `--gradient-end`: HSL 220 90% 56% (royal blue)
- `--primary`: HSL 195 100% 50% (cyan)
- `--secondary`: HSL 210 100% 50% (deep blue)

### Técnica de borda gradiente
Para criar uma borda com gradiente em um elemento circular, usamos a técnica de `background-clip` com dois backgrounds:
1. Background interno sólido (cor do fundo)
2. Background externo com gradiente (visível apenas na borda)

### Glow effect
Box-shadow com cores primárias em múltiplas camadas com opacidade decrescente cria o efeito de brilho característico.
