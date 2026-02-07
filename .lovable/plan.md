
# Plano: Sistema de Templates de Projeto

## Resumo

Implementar um sistema onde o admin pode criar templates de projetos pré-configurados, e os usuários podem escolher usar um template ou criar do zero ao iniciar um novo projeto.

---

## 1. Fluxo do Usuário ao Criar Projeto

Quando o usuário clica em "Novo Projeto" na página de projetos:

```text
+------------------------------------------+
|        Como você quer começar?           |
+------------------------------------------+
|                                          |
|  [  Começar do Zero  ]                   |
|                                          |
|  ─────── ou usar um template ───────     |
|                                          |
|  +--------+  +--------+  +--------+      |
|  |  Img   |  |  Img   |  |  Img   |      |
|  |Template|  |Template|  |Template|      |
|  |  Name  |  |  Name  |  |  Name  |      |
|  +--------+  +--------+  +--------+      |
|                                          |
+------------------------------------------+
```

---

## 2. Gestão de Templates no Admin

Na aba "Templates" do painel admin:

```text
+------------------------------------------+
| Templates de Projeto         [+ Criar]   |
+------------------------------------------+
| +--------+ +--------------------------+  |
| |  Img   | | Nome: Template Produto   |  |
| |        | | Descrição: Para fotos... |  |
| +--------+ | Criado: 07/02/2026       |  |
|            | [Editar] [Excluir]       |  |
+------------------------------------------+
```

**Fluxo de criação de template:**
1. Admin clica em "Criar Template"
2. Abre modal com:
   - Nome do template
   - Descrição
   - Upload de thumbnail (imagem de preview)
   - Seletor de projeto existente para importar o canvas_state
3. Admin salva e o template fica disponível para todos os usuários

---

## 3. Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/Projects.tsx` | Substituir dialog de criação por modal com opção de templates |
| `src/pages/Admin.tsx` | Implementar aba de Templates completa (CRUD) |

### Novo Componente

| Arquivo | Descrição |
|---------|-----------|
| `src/components/CreateProjectModal.tsx` | Modal com escolha entre "do zero" e templates |

---

## 4. Detalhes Técnicos

### CreateProjectModal.tsx

```typescript
interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFromScratch: (name: string) => void;
  onCreateFromTemplate: (name: string, templateId: string) => void;
}
```

**Estados:**
- `step`: 'choose' | 'name' (escolher template ou digitar nome)
- `selectedTemplate`: template selecionado (ou null para do zero)
- `projectName`: nome do novo projeto

**Fluxo:**
1. Usuário escolhe "do zero" ou seleciona um template
2. Digita o nome do projeto
3. Clica em "Criar"
4. Se template selecionado, o `canvas_state` do template é copiado para o novo projeto

### Mudanças no Projects.tsx

**createMutation atualizada:**
```typescript
mutationFn: async ({ name, templateId }: { name: string; templateId?: string }) => {
  let canvasState = { nodes: [], edges: [] };
  
  if (templateId) {
    // Buscar canvas_state do template
    const { data: template } = await supabase
      .from('project_templates')
      .select('canvas_state')
      .eq('id', templateId)
      .single();
    
    if (template?.canvas_state) {
      canvasState = template.canvas_state as { nodes: [], edges: [] };
      // Regenerar IDs dos nós para evitar conflitos
      canvasState.nodes = canvasState.nodes.map(node => ({
        ...node,
        id: `${node.type}-${Date.now()}-${Math.random()}`
      }));
    }
  }
  
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, user_id: user?.id, canvas_state: canvasState })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

### Mudanças no Admin.tsx - Aba Templates

**Novos estados:**
```typescript
const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
const [newTemplate, setNewTemplate] = useState({
  name: '',
  description: '',
  thumbnail_url: '',
  canvas_state: { nodes: [], edges: [] }
});
const [selectedProjectForTemplate, setSelectedProjectForTemplate] = useState<string | null>(null);
```

**Query para buscar projetos do admin (para importar canvas):**
```typescript
const { data: adminProjects } = useQuery({
  queryKey: ['admin-projects'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, canvas_state')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },
});
```

**Query para buscar templates:**
```typescript
const { data: templates, isLoading: templatesLoading } = useQuery({
  queryKey: ['admin-templates'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('project_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
});
```

**Mutation para criar template:**
```typescript
const createTemplateMutation = useMutation({
  mutationFn: async (template: typeof newTemplate) => {
    const { error } = await supabase
      .from('project_templates')
      .insert({
        name: template.name,
        description: template.description,
        thumbnail_url: template.thumbnail_url,
        canvas_state: template.canvas_state,
        created_by: user?.id
      });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
    setTemplateDialogOpen(false);
    resetTemplateForm();
    toast({ title: 'Template criado!' });
  },
});
```

**Mutation para deletar template:**
```typescript
const deleteTemplateMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('project_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
    toast({ title: 'Template excluído!' });
  },
});
```

---

## 5. UI do Modal de Criação de Template (Admin)

```text
+------------------------------------------+
|          Criar Novo Template         [X] |
+------------------------------------------+
|                                          |
|  Nome do Template                        |
|  [________________________________]      |
|                                          |
|  Descrição                               |
|  [________________________________]      |
|  [________________________________]      |
|                                          |
|  Thumbnail                               |
|  +-------------------+                   |
|  |     [Upload]      |                   |
|  +-------------------+                   |
|                                          |
|  Importar canvas de um projeto           |
|  [Selecione um projeto ▼]               |
|                                          |
+------------------------------------------+
|                    [Cancelar] [Criar]    |
+------------------------------------------+
```

---

## 6. Storage para Thumbnails

O bucket `reference-images` já é público e pode ser reutilizado para thumbnails de templates, ou podemos usar uma pasta específica dentro dele.

---

## 7. Layout Visual dos Templates (Para Usuários)

Cards estilizados mostrando:
- Thumbnail do template
- Nome
- Descrição curta
- Botão "Usar este template"

```text
+------------------+
|    [Thumbnail]   |
|                  |
+------------------+
| Template Name    |
| Descrição curta  |
| [Usar template]  |
+------------------+
```

---

## Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/CreateProjectModal.tsx` |
| Modificar | `src/pages/Projects.tsx` |
| Modificar | `src/pages/Admin.tsx` |
