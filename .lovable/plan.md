

## Salvar Projeto como Template (Admin)

### Resumo
Adicionar a funcionalidade para que o admin possa, de dentro do Editor de um projeto existente, salvar o canvas atual como um template -- criando um novo template ou atualizando um template existente.

### Mudancas

**1. Criar componente `SaveAsTemplateModal`**

Novo arquivo: `src/components/SaveAsTemplateModal.tsx`

- Modal com duas opcoes: "Salvar como novo template" e "Atualizar template existente"
- Campos: nome do template, descricao (opcionais, pre-preenchidos com nome do projeto)
- Dropdown/select para escolher template existente (caso queira sobrescrever)
- Ao salvar:
  - Usa a funcao `sanitizeCanvasState` existente para limpar o canvas
  - Insere ou atualiza na tabela `project_templates` com o `canvas_state` limpo
- Exibe toast de sucesso/erro

**2. Adicionar botao "Salvar como Template" no Editor**

Arquivo: `src/pages/Editor.tsx`

- Renderizar o botao apenas quando `isAdmin === true` (do `useAuth()`)
- Botao na barra superior do editor, ao lado do indicador de salvamento
- Ao clicar, abre o `SaveAsTemplateModal` passando os nodes e edges atuais
- O modal recebe `projectName` como valor padrao do nome do template

**3. Fluxo do Modal**

```text
Admin clica "Salvar como Template"
  --> Modal abre com duas abas/opcoes:
      [Novo Template]
        - Nome (pre-preenchido com nome do projeto)
        - Descricao (opcional)
        - Botao "Criar Template"
      [Atualizar Existente]
        - Select com lista de templates existentes
        - Botao "Atualizar"
  --> Salva canvas_state sanitizado na tabela project_templates
  --> Toast de confirmacao
```

### Detalhes Tecnicos

- O componente `SaveAsTemplateModal` vai:
  - Fazer query na tabela `project_templates` para listar templates existentes (apenas id e nome)
  - Reutilizar a funcao `sanitizeCanvasState` ja existente no Editor.tsx (sera exportada)
  - Usar `supabase.from('project_templates').insert(...)` para novo ou `.update(...).eq('id', selectedId)` para atualizar
  - Receber `nodes`, `edges`, `projectName` e `userId` como props

- No `Editor.tsx`:
  - Exportar `sanitizeCanvasState` para uso no modal
  - Importar `SaveAsTemplateModal` e adicionar state `showSaveTemplate`
  - Condicionar renderizacao do botao a `isAdmin` do `useAuth()`

- Nenhuma mudanca de schema necessaria -- a tabela `project_templates` ja tem todos os campos necessarios (`canvas_state`, `name`, `description`, `created_by`)

