

## Configurar Entregaveis por Plano e Restricao de Templates

### Resumo
Implementar o sistema de planos (free, starter, creator, enterprise) com limites de creditos mensais e projetos, e adicionar controle de quais planos podem acessar cada template.

### Mudancas

**1. Migracoes de banco de dados**

- Adicionar coluna `allowed_tiers` (text array) na tabela `project_templates` com default `'{free,starter,creator,enterprise}'` -- por padrao todos os planos tem acesso
- Adicionar coluna `max_projects` (integer) na tabela `profiles` com default `1` -- limite de projetos por usuario

**2. Definir limites por plano (constante no frontend)**

Criar `src/lib/plan-limits.ts` com a configuracao:

```text
free:       credits_month=5,    max_projects=1,  label="Free"
starter:    credits_month=100,  max_projects=3,  label="Starter"
creator:    credits_month=300,  max_projects=-1,  label="Creator"     (-1 = ilimitado)
enterprise: credits_month=800,  max_projects=-1,  label="Enterprise"  (-1 = ilimitado)
```

**3. Limitar criacao de projetos**

Arquivo: `src/pages/Projects.tsx`
- Antes de abrir o modal de criar projeto, verificar quantos projetos o usuario ja tem vs o limite do plano
- Se atingiu o limite, exibir toast informando e bloquear a criacao
- Exibir badge com "X/Y projetos" na pagina

**4. Filtrar templates por plano do usuario**

Arquivo: `src/components/CreateProjectModal.tsx`
- Na query de templates, filtrar pelo `tier` do usuario usando `.contains('allowed_tiers', [userTier])`
- Templates que o usuario nao tem acesso nao aparecem

**5. Adicionar selecao de planos no SaveAsTemplateModal**

Arquivo: `src/components/SaveAsTemplateModal.tsx`
- Adicionar checkboxes para selecionar quais planos tem acesso ao template (free, starter, creator, enterprise)
- Enviar `allowed_tiers` no insert/update

**6. Adicionar selecao de planos no TemplateEditor**

Arquivo: `src/pages/TemplateEditor.tsx`
- Na secao de metadados, adicionar checkboxes para `allowed_tiers`
- Salvar junto com o template no auto-save

**7. Exibir planos na listagem de templates (Admin)**

Arquivo: `src/components/admin/TemplatesTab.tsx`
- Buscar e exibir `allowed_tiers` como badges em cada card de template

### Detalhes Tecnicos

A coluna `allowed_tiers` sera um array de texto (`text[]`) no Postgres. A filtragem no frontend usara o operador `cs` (contains) do Supabase: `.contains('allowed_tiers', [profile.tier])`.

O limite de projetos sera verificado no frontend contando os projetos existentes do usuario. A validacao e apenas no frontend por enquanto (o RLS ja garante que usuarios so acessam seus proprios projetos).

Os tiers validos serao: `free`, `starter`, `creator`, `enterprise`. O campo `tier` na tabela `profiles` ja existe e atualmente tem default `'free'`.

