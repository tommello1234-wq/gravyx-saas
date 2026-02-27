

## Plano: Banner de manutenção na página do Editor

### O que será feito
Adicionar um banner informativo fixo na parte inferior centralizada da página do Editor (`/app`), avisando sobre manutenção. O banner será dismissible (botão X) e não bloqueará a geração de imagens.

### Implementação

1. **Adicionar banner no `src/pages/Editor.tsx`**:
   - Componente inline com `useState` para controlar visibilidade (dismissible)
   - Posicionado com `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
   - Estilo: fundo amarelo/âmbar suave com glassmorphism (`bg-yellow-500/10 border-yellow-500/30 backdrop-blur-xl`), bordas arredondadas, ícone `AlertTriangle`
   - Texto principal + lista de atualizações previstas
   - Botão X para fechar
   - Responsivo com `max-w-xl w-[90vw]`

### Texto do banner
- **Título**: "⚠️ Estamos em manutenção para melhor lhe atender"
- **Corpo**: "Não recomendamos que você gere imagens no momento."
- **Atualizações previstas**:
  - Melhoria no node de Resultado
  - Atualização para a nova inteligência do Google (Nano Banana 2)

