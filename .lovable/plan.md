# Plano: Nova Arquitetura Gravity + Resultado

## ✅ IMPLEMENTADO

### Arquitetura de 4 Nodes

| Node | Função | Status |
|------|--------|--------|
| **Prompt** | Texto descritivo | ✅ Mantido |
| **Mídia** | Imagem de referência | ✅ Mantido |
| **Gravity** | Agregador (opcional) | ✅ Criado |
| **Resultado** | Configs + Geração + Preview | ✅ Criado |

### Fluxos Implementados

**Fluxo Simples (sem Gravity):**
```
Prompt ──┬──▶ RESULTADO ──▶ [Gerar]
Mídia  ──┘
```

**Fluxo Organizado (com Gravity):**
```
Prompt ──┐                     
         ├──▶ [GRAVITY] ───────┬──▶ RESULTADO 1
Mídia  ──┘    (Gerar Todos)    └──▶ RESULTADO 2
```

### Arquivos Criados/Modificados

- ✅ `src/components/nodes/ResultNode.tsx` - Merge de Settings + Output
- ✅ `src/components/nodes/GravityNode.tsx` - Node circular agregador
- ✅ `src/components/nodes/GravityPopup.tsx` - Modal de configuração
- ✅ `src/pages/Editor.tsx` - Nova lógica de geração
- ✅ `src/components/editor/NodeToolbar.tsx` - Novos tipos de node

### Lógica de Agregação

```
prompt_final = prompts_gravity (conectados + internos) + prompts_locais
midias_final = midias_gravity (conectadas + internas) + midias_locais
config_final = configurações do próprio Resultado (sempre)
```

### Compatibilidade

- Nodes antigos (settings/output) continuam funcionando
- Projetos existentes não são afetados
