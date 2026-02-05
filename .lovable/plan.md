
# Painel Admin Completo + Biblioteca no MediaNode

## Resumo

Este plano implementa:
1. Configurar você como admin no banco de dados
2. Melhorar o painel admin com upload de imagens para biblioteca e gerenciamento de usuários
3. Adicionar seleção de imagens da biblioteca no MediaNode com opção de copiar prompt

## Mudanças Necessárias

### 1. Migração SQL - Criar seu papel de Admin

Inserir seu usuário na tabela `user_roles` como admin para liberar acesso ao painel:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('48f8cc37-92ab-402f-b9a7-8a4ea6f1a45a', 'admin');
```

### 2. Migração SQL - Política RLS para Admins Gerenciarem Profiles

Atualmente admins não conseguem ver nem editar profiles de outros usuários. Precisamos adicionar:

```sql
-- Permitir admins ver todos os profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Permitir admins atualizar todos os profiles
CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

### 3. Atualizar Admin.tsx - Upload de Imagens para Biblioteca

Modificar o formulário de nova referência para permitir upload de arquivo ao invés de apenas URL:
- Adicionar input de arquivo com preview
- Fazer upload para bucket `reference-images` na pasta admin
- Salvar URL pública no banco

### 4. Atualizar MediaNode.tsx - Seleção da Biblioteca

Transformar o MediaNode para ter duas opções:
- **Upload**: Manter funcionalidade atual de upload próprio
- **Biblioteca**: Abrir modal/drawer com grid de imagens da biblioteca
  - Buscar da tabela `reference_images`
  - Mostrar imagem, título e categoria
  - Botão de copiar prompt ao lado de cada imagem
  - Ao clicar na imagem, seleciona como referência

### Arquitetura do MediaNode Atualizado

```text
+-------------------------------------------+
|  [Ícone] Mídia           [📝] [📋] [🗑️]   |
+-------------------------------------------+
|                                           |
|  [Se sem imagem]                          |
|  +---------------------------------------+|
|  |  [Upload]  |  [Biblioteca]            ||
|  +---------------------------------------+|
|                                           |
|  [Se com imagem]                          |
|  +---------------------------------------+|
|  |  [Imagem selecionada]          [X]    ||
|  +---------------------------------------+|
|                                           |
+-------------------------------------------+
                                         [●]
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/...` | Adicionar admin role + políticas RLS |
| `src/pages/Admin.tsx` | Adicionar upload de arquivo no formulário de referências |
| `src/components/nodes/MediaNode.tsx` | Adicionar tabs Upload/Biblioteca e modal de seleção |
| `src/components/nodes/LibraryModal.tsx` | Novo componente para modal da biblioteca |

## Detalhes Técnicos

### Upload no Admin
```tsx
// Adicionar ref para input de arquivo
const fileInputRef = useRef<HTMLInputElement>(null);
const [uploadingImage, setUploadingImage] = useState(false);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);

const handleImageUpload = async (file: File) => {
  const fileName = `admin/${Date.now()}.${file.name.split('.').pop()}`;
  await supabase.storage.from('reference-images').upload(fileName, file);
  const { data } = supabase.storage.from('reference-images').getPublicUrl(fileName);
  setNewRef({ ...newRef, image_url: data.publicUrl });
  setPreviewUrl(data.publicUrl);
};
```

### Biblioteca no MediaNode
```tsx
// Novo estado
const [showLibrary, setShowLibrary] = useState(false);

// Buscar imagens da biblioteca
const { data: libraryImages } = useQuery({
  queryKey: ['library-images'],
  queryFn: async () => {
    const { data } = await supabase.from('reference_images').select('*');
    return data;
  },
});

// Função para selecionar da biblioteca
const selectFromLibrary = (image: ReferenceImage) => {
  handleUrlChange(image.image_url);
  // Salvar prompt associado para uso posterior
  (data as Record<string, unknown>).libraryPrompt = image.prompt;
  setShowLibrary(false);
};
```
