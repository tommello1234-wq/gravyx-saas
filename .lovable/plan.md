

# Plano: Limpeza de Projetos Inflados e Otimização do Banco de Dados

## Diagnóstico Completo

### Problema Identificado
O aviso de **Disk IO Budget** não está relacionado ao espaço em disco (você tem 250GB livres), mas sim à **velocidade de leitura/escrita (IOPS)**. O plano MICRO tem limites de operações por segundo.

### Causa Raiz
6 projetos antigos contêm **imagens Base64 embutidas** no `canvas_state`:

| Projeto | Tamanho | Base64? |
|---------|---------|---------|
| criar | 14.6 MB | ✅ Sim |
| Teste | 7.8 MB | ✅ Sim |
| dddd | 7.6 MB | ✅ Sim |
| criar uma página de vendas | 2.6 MB | ✅ Sim |
| hhhh | 2.3 MB | ✅ Sim |
| Oi | 1.7 MB | ✅ Sim |
| **Total** | **~36 MB** | |

**Projetos limpos** (sem Base64) têm apenas **1-8 KB** cada.

O auto-save do Editor (a cada 3 segundos) grava esses JSONs gigantes repetidamente, esgotando o orçamento de IO.

### Tamanho Atual das Tabelas
- `generations`: 368 MB (normal - são as imagens geradas)
- `projects`: 145 MB (problemático - deveria ser < 1 MB)
- `project_templates`: 8.6 MB (pode ter o mesmo problema)

---

## Solução

### Passo 1: Limpeza Imediata dos Projetos Inflados

Criar uma migration SQL que:
1. Remove strings Base64 de `canvas_state` nos nós de mídia
2. Remove o array `images` dos nós de output (já carregam da tabela `generations`)
3. Mantém apenas dados estruturais

```sql
-- Remove Base64 e images de TODOS os projetos
UPDATE projects
SET canvas_state = (
  SELECT jsonb_build_object(
    'nodes', (
      SELECT jsonb_agg(
        CASE 
          -- Output nodes: remove images array
          WHEN node->>'type' = 'output' THEN 
            jsonb_set(node, '{data}', (node->'data') - 'images')
          -- Media nodes: remove base64 URLs
          WHEN node->>'type' = 'media' 
               AND node->'data'->>'url' LIKE 'data:image%' THEN
            jsonb_set(node, '{data,url}', 'null'::jsonb)
          ELSE node
        END
      )
      FROM jsonb_array_elements(canvas_state->'nodes') AS node
    ),
    'edges', canvas_state->'edges'
  )
)
WHERE canvas_state::text LIKE '%data:image%'
   OR canvas_state::text LIKE '%"images":%';
```

### Passo 2: Limpar Templates Também

```sql
-- Mesma lógica para project_templates
UPDATE project_templates
SET canvas_state = (
  SELECT jsonb_build_object(
    'nodes', (
      SELECT jsonb_agg(
        CASE 
          WHEN node->>'type' = 'output' THEN 
            jsonb_set(node, '{data}', (node->'data') - 'images')
          WHEN node->>'type' = 'media' 
               AND node->'data'->>'url' LIKE 'data:image%' THEN
            jsonb_set(node, '{data,url}', 'null'::jsonb)
          ELSE node
        END
      )
      FROM jsonb_array_elements(canvas_state->'nodes') AS node
    ),
    'edges', canvas_state->'edges'
  )
)
WHERE canvas_state::text LIKE '%data:image%'
   OR canvas_state::text LIKE '%"images":%';
```

### Passo 3: VACUUM para Recuperar Espaço

```sql
-- Recupera o espaço em disco após a limpeza
VACUUM (ANALYZE) projects;
VACUUM (ANALYZE) project_templates;
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tabela `projects` | 145 MB | < 500 KB |
| Maior projeto | 14.6 MB | ~8 KB |
| IO por save | Alto | Mínimo |
| Disk IO Budget | Esgotado | Normal |

---

## Sobre Upgrade de Plano

### MICRO (atual) - $25/mês
- Suporta: **5-15 alunos simultâneos** (com a limpeza)
- 2 vCPUs, 1GB RAM
- IO limitado

### SMALL - $50/mês
- Suporta: **20-50 alunos simultâneos**
- 2 vCPUs, 2GB RAM
- IO dobrado

### MEDIUM - $100/mês
- Suporta: **50-100+ alunos simultâneos**
- 2 vCPUs, 4GB RAM
- IO quadruplicado

**Recomendação**: 
- Para turma < 20 alunos: **MICRO é suficiente** após a limpeza
- Para turma 20-50 alunos: Upgrade para **SMALL**
- Para turma > 50 alunos: Upgrade para **MEDIUM**

---

## Arquivos/Ações

| Ação | Descrição |
|------|-----------|
| Nova migration SQL | Limpa Base64 e images de projetos existentes |
| VACUUM automático | Recupera espaço em disco |

---

## Após a Limpeza

1. O aviso de Disk IO Budget deve desaparecer em minutos
2. O auto-save do Editor vai funcionar de forma leve
3. Projetos antigos dos alunos serão limpos automaticamente
4. O sistema estará pronto para distribuição

