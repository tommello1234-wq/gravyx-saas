
# Plano: Melhorias de Autenticação e Sistema de Galeria no OutputNode

## Visão Geral
Este plano aborda três áreas principais:
1. Tratamento de erros de autenticação mais específicos
2. Sistema de galeria acumulativa no OutputNode com popup de ações
3. Garantir funcionamento para todos os usuários

---

## 1. Melhorias na Autenticação

### 1.1 Criar Conta com Email Já Cadastrado
**Arquivo:** `src/pages/Auth.tsx`

**Situação Atual:** Já existe tratamento parcial (linha 66-71) que verifica se a mensagem contém "already registered".

**Melhoria:** Tornar a mensagem mais clara e adicionar um link para alternar para o modo login.

```tsx
if (error.message.includes('already registered') || error.message.includes('User already registered')) {
  toast({
    title: 'Email já cadastrado',
    description: 'Este email já está em uso. Clique em "Entrar" para fazer login.',
    variant: 'destructive',
  });
  setIsLogin(true); // Automaticamente muda para modo login
}
```

### 1.2 Recuperar Senha com Email Não Cadastrado
**Arquivo:** `src/pages/ResetPassword.tsx`

**Problema:** O Supabase não retorna erro quando o email não existe por questões de segurança (evitar enumeration attack). Porém, podemos verificar primeiro se o email existe antes de enviar.

**Solução:** Adicionar verificação prévia consultando a tabela de profiles e exibir mensagem apropriada.

```tsx
// Antes de enviar o reset, verificar se email existe
const { data: existingUser } = await supabase
  .from('profiles')
  .select('email')
  .eq('email', data.email)
  .maybeSingle();

if (!existingUser) {
  toast({
    title: 'Email não encontrado',
    description: 'Este email não está cadastrado. Crie uma conta primeiro.',
    variant: 'destructive',
  });
  return;
}
```

---

## 2. Sistema de Galeria Acumulativa no OutputNode

### 2.1 Problema Atual
- Cada nova geração **substitui** as imagens anteriores no node
- Não há opção de salvar na galeria permanente, excluir ou baixar individualmente
- Quando o usuário sai e volta, apenas a última geração aparece

### 2.2 Solução: Acumular Imagens

**Arquivo:** `src/pages/Editor.tsx`

Modificar o `handleGenerate` para **acumular** imagens ao invés de substituir:

```tsx
// Linha ~190-198 - Mudança de lógica
setNodes((nds) => {
  const updated = nds.map((n) =>
    n.id === outputNode.id
      ? { 
          ...n, 
          data: { 
            ...n.data, 
            // ACUMULAR ao invés de substituir
            images: [...(n.data.images || []), ...data.images], 
            isLoading: false 
          } 
        }
      : n
  );
  setTimeout(() => saveProject(updated, edges), 100);
  return updated;
});
```

### 2.3 Criar Modal de Ações para Imagens

**Novo Arquivo:** `src/components/nodes/OutputImageModal.tsx`

Modal que aparece ao clicar em uma imagem no OutputNode com opções:

```text
┌─────────────────────────────────────────┐
│  [X]                                    │
│                                         │
│         [Imagem Grande]                 │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Prompt utilizado...                 ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Salvar   │ │ Baixar   │ │ Excluir  ││
│  │ Galeria  │ │          │ │          ││
│  └──────────┘ └──────────┘ └──────────┘│
└─────────────────────────────────────────┘
```

**Funcionalidades:**
- **Salvar na Galeria:** Insere na tabela `generations` com `saved_to_gallery: true`
- **Baixar:** Download direto da imagem
- **Excluir:** Remove a imagem do array de imagens do node

### 2.4 Modificar OutputNode

**Arquivo:** `src/components/nodes/OutputNode.tsx`

Adicionar:
1. Estado para controlar o modal
2. Clique nas imagens abre o modal
3. Funções para salvar/excluir/baixar
4. Exibir todas as imagens acumuladas

```tsx
interface OutputNodeData {
  label: string;
  images: Array<{
    url: string;
    prompt: string;  // Guardar o prompt de cada imagem
    savedToGallery?: boolean;
  }>;
  isLoading: boolean;
}
```

### 2.5 Atualizar Estrutura de Dados

Para que cada imagem tenha seu próprio prompt e estado, precisamos mudar como salvamos as imagens:

**No Editor.tsx (handleGenerate):**
```tsx
// Ao invés de apenas URLs, salvar objetos com metadata
const newImage = {
  url: data.images[0],
  prompt: prompt,
  aspectRatio: aspectRatio,
  savedToGallery: false,
  generatedAt: new Date().toISOString()
};
```

---

## 3. Migração de Banco de Dados

Adicionar coluna `saved_to_gallery` na tabela `generations` (se ainda não existir):

```sql
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS saved_to_gallery boolean DEFAULT false;
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/Auth.tsx` | Modificar | Mudar para modo login ao detectar email já cadastrado |
| `src/pages/ResetPassword.tsx` | Modificar | Verificar se email existe antes de enviar reset |
| `src/pages/Editor.tsx` | Modificar | Acumular imagens no output, salvar metadata |
| `src/components/nodes/OutputNode.tsx` | Modificar | Grid de imagens com clique para abrir modal |
| `src/components/nodes/OutputImageModal.tsx` | Criar | Modal com ações (salvar, baixar, excluir) |

---

## Fluxo do Usuário (Após Implementação)

1. Usuário gera uma imagem → Aparece no OutputNode
2. Usuário gera outra imagem → **Acumula** junto com a anterior
3. Usuário clica em uma imagem → Abre popup grande
4. No popup pode:
   - **Salvar na Galeria** → Marca `saved_to_gallery: true` e aparece em `/gallery`
   - **Baixar** → Download do arquivo
   - **Excluir** → Remove do node (não vai para galeria)
5. Ao sair e voltar → Todas as imagens acumuladas permanecem visíveis

---

## Detalhes Técnicos

### Estrutura do Novo Formato de Imagens no Node

```typescript
interface NodeImage {
  url: string;           // URL da imagem (base64 ou hosted)
  prompt: string;        // Prompt usado para gerar
  aspectRatio: string;   // Ex: "1:1", "16:9"
  savedToGallery: boolean;
  generatedAt: string;   // ISO timestamp
}

interface OutputNodeData {
  label: string;
  images: NodeImage[];
  isLoading: boolean;
}
```

### Função Salvar na Galeria

```typescript
const saveToGallery = async (image: NodeImage) => {
  await supabase.from('generations').insert({
    user_id: user.id,
    project_id: projectId,
    prompt: image.prompt,
    aspect_ratio: image.aspectRatio,
    image_url: image.url,
    status: 'completed',
    saved_to_gallery: true
  });
  
  // Atualizar estado local do node
  setNodes(nds => nds.map(n => 
    n.id === id ? {
      ...n,
      data: {
        ...n.data,
        images: n.data.images.map(img => 
          img.url === image.url ? { ...img, savedToGallery: true } : img
        )
      }
    } : n
  ));
};
```

### Compatibilidade com Dados Existentes

O código será retro-compatível:
- Se `images` for array de strings (formato antigo), converter para novo formato
- Se já for array de objetos, usar diretamente
