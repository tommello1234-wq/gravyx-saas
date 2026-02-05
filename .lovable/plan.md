

# Correção do Erro de Upload no MediaNode

## Problema Identificado

O bucket `reference-images` no Supabase Storage está configurado com uma política RLS que **permite upload apenas para administradores**. Usuários normais não conseguem fazer upload, resultando no erro "new row violates row-level security policy".

## Solução

Atualizar a política RLS do bucket `reference-images` para permitir que **usuários autenticados** façam upload de suas próprias imagens.

## Mudanças Necessárias

### 1. Migração SQL - Atualizar Política RLS

Remover a política atual restrita a admins e criar uma nova que permite upload para qualquer usuário autenticado, usando a mesma estrutura de path que os outros buckets (user_id como primeira pasta):

```sql
-- Remover política antiga (só admins)
DROP POLICY IF EXISTS "Admins can upload reference images" ON storage.objects;

-- Criar nova política para usuários autenticados
CREATE POLICY "Users can upload reference images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reference-images' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Adicionar política de DELETE para usuários poderem remover suas imagens
CREATE POLICY "Users can delete own reference images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reference-images' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

### 2. Verificar MediaNode.tsx

O código atual já usa o path correto (`${user.id}/${timestamp}.${ext}`), então não precisa de alteração no componente.

## Resumo Técnico

| Item | Antes | Depois |
|------|-------|--------|
| Quem pode fazer upload | Apenas admins | Qualquer usuário autenticado |
| Estrutura do path | N/A | `{user_id}/{filename}` |
| Delete próprias imagens | Não permitido | Permitido |

