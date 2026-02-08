
## Diagnóstico (por que ainda acontece, mesmo em aba anônima)
Não é cache. O comportamento vem de um trecho **legacy** no `src/pages/Editor.tsx`:

- Existe um efeito chamado **“POLLING FALLBACK”** (comentário: *“Check for new images every 5 seconds when there are pending jobs”*).
- Quando ele detecta imagens novas, ele faz isto:

```ts
if (n.type === 'output' || n.type === 'result') {
  images: allImages
}
```

Ou seja: **ele sobrescreve as imagens de TODOS os Result Nodes com o mesmo array `allImages`**, ignorando `result_node_id`.

Isso explica exatamente o que você descreveu:
- “depois de um tempo” → roda no `setInterval(..., 5000)`
- “quando sai e volta pra aba do projeto” → geralmente ainda existe `pendingJobs` durante/ao voltar, então o fallback roda e “replica” as imagens

## Objetivo da correção
Manter o fallback (se vocês quiserem) sem “vazar” imagens:
- Consultar `generations` incluindo `result_node_id`
- Agrupar por node
- Aplicar **apenas** as imagens correspondentes a cada `ResultNode` (mesma lógica do load inicial)

## Mudanças propostas (implementação)
### 1) Corrigir o “POLLING FALLBACK” no `Editor.tsx`
No bloco que começa em `// POLLING FALLBACK...`:

1. Trocar a query para incluir `result_node_id`:
   - De: `select('image_url, prompt, aspect_ratio, created_at')`
   - Para: `select('image_url, prompt, aspect_ratio, created_at, result_node_id')`

2. Remover a lógica `allImages` global e substituir por:
   - `imagesByNode = Map<nodeId, NodeImage[]>`
   - `sharedImages` para `result_node_id IS NULL` (ou ausente)
   - Aplicar:
     - Para cada node `type === 'result'`: `imagesByNode.get(node.id)`, e somente o primeiro Result recebe também `sharedImages` (compat legado)
     - Para `type === 'output'` (legado): somente `sharedImages` (ou manter como estava, mas sem afetar ResultNodes)

3. Evitar mutações com `.reverse()` em arrays compartilhados:
   - Usar `slice().reverse()` ao invés de `reverse()` direto (porque `reverse()` altera o array original e pode causar efeitos colaterais).

### 2) (Opcional, mas recomendado) Refatorar para não duplicar lógica
Criar uma função helper local no `Editor.tsx` (mesmo arquivo) tipo:
- `applyGenerationsToNodes(loadedNodes, generations)`  
e reutilizar tanto no **load inicial** quanto no **polling fallback**.
Isso reduz a chance de “arrumar num lugar e esquecer no outro”.

## Arquivo(s) que vou alterar
- `src/pages/Editor.tsx` (apenas)

## Como validar (passo a passo)
1. No Editor, crie **2 Result Nodes**.
2. Gere 1 imagem no Result A.
3. Aguarde **10–15 segundos** (para garantir que o polling rodou).
4. Verifique: Result B **não** deve receber a imagem do A.
5. Agora troque de aba (ou navegue para outra tela e volte ao projeto).
6. Verifique de novo: nada deve “espalhar”.
7. Recarregue a página.
8. Confirme: cada Result Node carrega somente as imagens com `result_node_id` dele.

## Observações
- Isso deve resolver o “vazamento” mesmo se por algum motivo `pendingJobs` ficar > 0 por mais tempo, porque o fallback deixará de aplicar “all images em todos os nodes”.
- Se depois disso ainda houver vazamento, o próximo suspeito seria algum outro “sync” que reatribui `images` globalmente (mas, pelo código atual, o polling fallback é o responsável direto).

<lov-actions>
  <lov-suggestion message="Teste end-to-end: gere imagens em 2 Result Nodes, aguarde 15s, troque de aba e recarregue para confirmar que não vaza entre nodes.">Verify that it works</lov-suggestion>
  <lov-suggestion message="Remover totalmente o POLLING FALLBACK (já existe Realtime + status polling em useJobQueue), para simplificar e reduzir risco de regressões.">Remover fallback redundante</lov-suggestion>
  <lov-suggestion message="Adicionar um pequeno painel de debug no Editor (visível só em dev) mostrando pendingJobs e o resultId associado, para diagnosticar rápido travas e vazamentos.">Painel de debug</lov-suggestion>
  <lov-suggestion message="Criar um botão 'Sincronizar imagens' em cada Result Node que recarrega apenas as generations daquele node via result_node_id.">Sync por node</lov-suggestion>
  <lov-suggestion message="Adicionar um indicador de saúde do Realtime (SUBSCRIBED / ERROR) no Editor para saber quando está dependendo de fallback.">Status do Realtime</lov-suggestion>
</lov-actions>
