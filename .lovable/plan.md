
Contexto do problema (o “porquê” caiu de novo)
- O seu Postgres está ficando “unhealthy” por overload + timeouts, e isso está sendo disparado principalmente por payloads gigantes em `projects.canvas_state`.
- Achei no banco que existem pelo menos 11 projetos com Base64 dentro do `canvas_state` (`canvas_state::text like '%data:image%'`).
- E existem projetos com `canvas_state` absurdamente grande (ex.: ~37.7 milhões de caracteres, ~18.3M, ~14.6M…). Um UPDATE desse campo reescreve dezenas de MB.
- Além disso, a página `/projects` hoje faz `.select('*')` na tabela `projects` (ou seja: ela puxa `canvas_state` de TODOS os projetos na listagem). Se você tem 1–3 projetos gigantes, só entrar/atualizar a listagem já vira uma “bomba” de leitura e pode derrubar o banco.
- Quando você gera imagens, o Editor atualiza o Output node (que contém `images`) e força um `saveProject` logo após a geração. Se aquele projeto ainda tinha Base64 antigo no Output, o save tenta gravar tudo de novo (gigante) e começa a estourar `statement timeout`, levando a “database not accepting connections”.

Objetivo da correção
1) Parar de “carregar e gravar caminhões de dados” no Postgres.
2) Garantir que geração de imagens não cause UPDATE gigantes em `projects`.
3) Limpar automaticamente os projetos que já estão “inflados” (remover Base64 do canvas_state) para estabilizar definitivamente.
4) Reduzir requisições e picos de carga durante geração.

Mudanças (implementação)

A) Cortar leituras gigantes (impacto imediato)
1. `src/pages/Projects.tsx`
   - Trocar `.select('*')` por algo como: `select('id,name,updated_at,created_at')`
   - Resultado: a listagem não puxa `canvas_state` (nem TOAST gigantes), reduzindo muito I/O e tempo de query.
2. `src/pages/Editor.tsx`
   - Trocar `.select('*')` por `select('name, canvas_state')`
   - Resultado: reduz payload desnecessário.

B) Nunca mais persistir imagens (nem Base64) dentro de `projects.canvas_state`
3. `src/pages/Editor.tsx` (núcleo do fix)
   - Criar uma função de “persistência limpa” do canvas:
     - Salvar apenas campos essenciais do node (ex.: `id`, `type`, `position`, `data` filtrado).
     - Remover campos transitórios do ReactFlow (ex.: `selected`, `dragging`, `measured`, `width/height`, etc.).
     - Para node `output`: não persistir `data.images` no banco (ou, alternativamente, persistir no máximo um histórico bem pequeno e SEM data:image).
   - Ajustar o `saveProject` para usar esse “estado limpo” antes de `JSON.stringify` e antes do UPDATE.
   - Remover o “force save” após geração:
     - Hoje existe `setTimeout(() => saveProject(updated, currentEdges), 100);`
     - Isso é perigoso porque grava imediatamente e pode tentar salvar um canvas ainda gigante.
     - Depois do refactor, a geração não precisa disparar save (as imagens ficam no estado local; o canvas persistido não inclui elas).

C) Auto-repair (limpar os projetos já gigantes) sem você ter que mexer no Supabase manualmente
4. `src/pages/Editor.tsx` (no load do projeto)
   - Ao carregar `canvas_state`, detectar:
     - se contém `data:image` (Base64) OU
     - se o tamanho serializado passa de um limite (ex.: > 1MB).
   - Se detectar, fazer:
     1) Sanitizar em memória (remover `data.images` e qualquer `url` que comece com `data:image`).
     2) Atualizar o projeto UMA vez no Supabase com o canvas_state sanitizado (agora pequeno).
     3) Mostrar um toast/aviso: “Otimizamos este projeto removendo imagens antigas do canvas para manter performance. Suas imagens ficam na Galeria.”
   - Isso “desinfla” os 11 projetos problemáticos e estabiliza o banco. É o ponto mais importante.

D) OutputNode continua mostrando imagens, mas via fonte correta (tabela `generations`)
5. `src/pages/Editor.tsx` (UX para não perder histórico)
   - Em vez de depender de imagens persistidas no `canvas_state`, preencher o Output node em runtime buscando em `generations` por `project_id` (ex.: últimas 20–50).
   - As novas imagens geradas entram instantaneamente no Output node (estado local) e opcionalmente a lista pode ser “mesclada” com as vindas do banco.
   - Resultado: histórico continua existindo, mas não explode `projects.canvas_state`.

E) Otimizações adicionais para reduzir ainda mais carga durante geração
6. `supabase/functions/generate-image/index.ts`
   - Remover o SELECT final de créditos:
     - O RPC `decrement_credits` retorna `integer` (novos créditos). Podemos usar esse retorno e computar reembolso localmente, evitando uma query extra por request.
   - Reduzir paralelismo agressivo:
     - Hoje `Promise.all` gera+upload em paralelo (até 4 uploads simultâneos por request).
     - Implementar um limitador de concorrência (ex.: 2 por vez) ou fazer upload sequencial para evitar picos (especialmente com 4 contas gerando ao mesmo tempo).
   - Resultado: menos burst no Storage (que também escreve metadata no DB) e menos chance de spike.

F) “Higiene” em telas admin/listagens que usam select('*') (prevenção de futuras bombas)
7. `src/components/admin/TemplatesTab.tsx`
   - Trocar `.select('*')` por colunas necessárias (id, name, description, thumbnail_url, created_at, created_by).
   - Mesmo que hoje templates estejam pequenos, evita repetir o mesmo erro.

Sequência recomendada (para reduzir risco)
1) Ajustar `/projects` para não selecionar `canvas_state` (mitigação imediata).
2) Refatorar persistência do Editor para estado limpo + remover forced save após geração.
3) Implementar auto-repair no load do Editor e publicar.
4) Ajustar Output para carregar histórico via `generations` (mantém UX).
5) Otimizar edge function (reduzir uma query + limitar concorrência).
6) Re-testar carga com múltiplas contas.

Como vamos validar (teste de aceitação)
- Teste 1 (estabilidade): abrir `/projects` com vários projetos e confirmar que não há travamentos nem picos.
- Teste 2 (geração): em 4 contas, gerar 20+ imagens (4 por vez) e verificar:
  - DB não entra em “unhealthy”
  - logs não mostram “canceling statement due to statement timeout”
  - requests no DB não disparam em avalanche
- Teste 3 (auto-repair): abrir um dos projetos grandes (os que tinham base64) e confirmar:
  - Ele abre
  - Aparece aviso de otimização
  - Depois disso, o tamanho do `canvas_state` cai drasticamente e o projeto deixa de “derrubar” o banco.

Riscos/observações
- Ao remover `data.images` do `canvas_state`, o usuário deixa de “reabrir e ver imagens antigas” diretamente do canvas. Por isso vamos preencher o Output via `generations` (histórico continua existindo).
- O primeiro load de um projeto gigantesco ainda precisa ler aquele JSON grande uma vez (até o auto-repair salvar a versão reduzida). Depois disso, fica leve permanentemente.

Arquivos que serão alterados
- `src/pages/Projects.tsx` (parar `.select('*')` em `projects`)
- `src/pages/Editor.tsx` (sanitização de persistência, auto-repair, remover forced save, carregar imagens via `generations`)
- `src/components/admin/TemplatesTab.tsx` (parar `.select('*')` em `project_templates`)
- `supabase/functions/generate-image/index.ts` (reduzir queries e limitar concorrência)

Resultado esperado
- Parar de gerar UPDATEs de dezenas de MB no `projects.canvas_state`.
- Queda drástica de timeouts/“db not accepting connections”.
- Banco deixa de cair mesmo com geração simultânea em múltiplas contas.
- Requisições do “Database requests” passam a refletir o necessário (geração + storage) sem avalanche por canvas_state gigante.
