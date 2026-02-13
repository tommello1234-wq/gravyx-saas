

## Trocar "Ultimo Login" por "Data de Cadastro" na tabela de usuarios

### Resumo
Substituir a coluna "Ultimo Login" pela "Data de Cadastro" (`created_at` da tabela `profiles`) na tabela de usuarios do admin. A ordenacao por clique no cabecalho ja funciona -- so precisa apontar para o campo correto.

### Mudancas

**Arquivo: `src/components/admin/dashboard/UsersTable.tsx`**

1. **Renomear o SortKey** `'last_login'` para `'created_at'`
2. **No mapeamento de usuarios** (`filteredUsers`), trocar `last_login: data.authUsers[...]` por usar `p.created_at` que ja vem do profile
3. **Na ordenacao**, trocar o case `'last_login'` por `'created_at'` comparando as datas de cadastro
4. **No cabecalho da tabela**, trocar o texto "Ultimo Login" por "Cadastro" e apontar para `toggleSort('created_at')`
5. **Na celula de cada linha**, exibir `profile.created_at` formatado com `dd/MM/yy`
6. **No export CSV**, trocar o header "Ultimo Login" por "Data de Cadastro" e usar `created_at`

Nenhuma mudanca de banco de dados necessaria -- `created_at` ja existe na tabela `profiles`.
