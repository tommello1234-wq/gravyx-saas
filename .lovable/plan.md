

# Plano: Editor de Templates no Admin

## Resumo

Criar uma página de editor dedicada para montar templates diretamente no painel admin. Quando você clicar em "Editar" ou "Criar Template", vai abrir um editor completo com o canvas de nós, igual ao editor de projetos, mas salvando na tabela `project_templates`.

---

## Fluxo do Admin

```text
Aba Templates                    Página TemplateEditor
+---------------------------+    +----------------------------------+
| Templates     [+ Criar]   |    | [< Voltar]  Template X   [Salvo] |
|                           |    +----------------------------------+
| +--------+  +--------+    |    |  [Toolbar]                       |
| |Template|  |Template|    | -> |                                  |
| |  Name  |  |  Name  |    |    |     [Canvas ReactFlow]           |
| |[Editar]|  |[Editar]|    |    |                                  |
| +--------+  +--------+    |    |                                  |
+---------------------------+    +----------------------------------+
```

**Fluxo:**
1. Admin clica em "Criar Template" ou "Editar" em um template existente
2. Abre a página `/admin/template-editor?id=xxx` (ou sem id para novo)
3. Admin monta o canvas com os nós (Prompt, Mídia, Settings, Output)
4. Auto-save salva diretamente na tabela `project_templates`
5. Botão "Voltar" retorna para o painel admin

---

## Arquivos a Criar/Modificar

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/pages/TemplateEditor.tsx` | Página com editor de canvas para templates |
| Modificar | `src/components/admin/TemplatesTab.tsx` | Adicionar botão "Editar" e navegação |
| Modificar | `src/App.tsx` | Adicionar rota `/admin/template-editor` |

---

## Detalhes Técnicos

### TemplateEditor.tsx

Página similar ao Editor.tsx, mas:
- Carrega/salva na tabela `project_templates` em vez de `projects`
- Inclui campos para editar nome, descrição e thumbnail
- Não tem funcionalidade de geração de imagens (é só para montar o layout)
- Possui verificação de admin antes de acessar

**Estrutura:**
```text
+------------------------------------------+
| [← Voltar ao Admin]                      |
+------------------------------------------+
| Nome: [_______________]                  |
| Descrição: [_______________]             |
| Thumbnail: [Upload]                      |
+------------------------------------------+
|                                          |
|  [Toolbar]     [Canvas ReactFlow]        |
|                                          |
+------------------------------------------+
|                     Salvando...          |
+------------------------------------------+
```

**Estados:**
```typescript
const [templateId, setTemplateId] = useState<string | null>(null);
const [templateName, setTemplateName] = useState('Novo Template');
const [templateDescription, setTemplateDescription] = useState('');
const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);
const [isSaving, setIsSaving] = useState(false);
```

**Carregar template existente:**
```typescript
useEffect(() => {
  const loadTemplate = async () => {
    if (!templateId) return;
    
    const { data, error } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (data) {
      setTemplateName(data.name);
      setTemplateDescription(data.description || '');
      setThumbnailUrl(data.thumbnail_url);
      const canvas = data.canvas_state as { nodes?: Node[]; edges?: Edge[] };
      if (canvas?.nodes) setNodes(canvas.nodes);
      if (canvas?.edges) setEdges(canvas.edges);
    }
  };
  loadTemplate();
}, [templateId]);
```

**Salvar template (com debounce):**
```typescript
const saveTemplate = async () => {
  const canvasData = { nodes, edges };
  
  if (templateId) {
    // Update existing
    await supabase
      .from('project_templates')
      .update({
        name: templateName,
        description: templateDescription,
        thumbnail_url: thumbnailUrl,
        canvas_state: canvasData
      })
      .eq('id', templateId);
  } else {
    // Create new
    const { data } = await supabase
      .from('project_templates')
      .insert({
        name: templateName,
        description: templateDescription,
        thumbnail_url: thumbnailUrl,
        canvas_state: canvasData,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (data) {
      setTemplateId(data.id);
      // Update URL without reload
      navigate(`/admin/template-editor?id=${data.id}`, { replace: true });
    }
  }
};
```

### Modificações no TemplatesTab.tsx

**Adicionar botão "Editar" nos cards:**
```typescript
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => navigate(`/admin/template-editor?id=${template.id}`)}
  >
    <Pencil className="h-4 w-4 mr-1" />
    Editar
  </Button>
  <Button
    variant="ghost"
    size="icon"
    className="text-destructive"
    onClick={() => {
      setTemplateToDelete(template);
      setDeleteDialogOpen(true);
    }}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

**Mudar "Criar Template" para navegar:**
```typescript
<Button onClick={() => navigate('/admin/template-editor')}>
  <Plus className="h-4 w-4 mr-2" />
  Criar Template
</Button>
```

### Nova Rota no App.tsx

```typescript
<Route path="/admin/template-editor" element={<TemplateEditor />} />
```

---

## Layout do TemplateEditor

```text
+----------------------------------------------------------+
| [← Voltar]                              [Salvando...]    |
+----------------------------------------------------------+
| +------------------+  +-------------------------------+  |
| | Nome             |  | Descrição                     |  |
| | [______________] |  | [____________________________]|  |
| +------------------+  +-------------------------------+  |
| | Thumbnail        |                                     |
| | [  Upload  ]     |                                     |
+----------------------------------------------------------+
|                                                          |
|  [Toolbar]                                               |
|  +----+                                                  |
|  |Type|     [===== Canvas ReactFlow =====]              |
|  +----+                                                  |
|  |Img |                                                  |
|  +----+                                                  |
|  |Cfg |                                                  |
|  +----+                                                  |
|  |Out |                                                  |
|  +----+                                                  |
|                                                          |
+----------------------------------------------------------+
```

---

## Proteção de Acesso

A página de TemplateEditor deve:
1. Verificar se o usuário está logado
2. Verificar se o usuário tem role `admin`
3. Redirecionar para `/` se não for admin

```typescript
const { user } = useAuth();
const { data: isAdmin } = useQuery({
  queryKey: ['is-admin', user?.id],
  queryFn: async () => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: user?.id,
      _role: 'admin'
    });
    return data;
  },
  enabled: !!user
});

useEffect(() => {
  if (isAdmin === false) {
    navigate('/');
  }
}, [isAdmin]);
```

---

## Resumo das Mudanças

| Arquivo | Ação |
|---------|------|
| `src/pages/TemplateEditor.tsx` | Criar - Editor completo para templates |
| `src/components/admin/TemplatesTab.tsx` | Modificar - Adicionar botão Editar, remover modal de criação |
| `src/App.tsx` | Modificar - Adicionar rota |

