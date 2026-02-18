
## Continuar Traduzindo Todos os Componentes Restantes

### Resumo

Traduzir todos os ~20 componentes restantes que ainda possuem textos hardcoded em portugues, usando o sistema i18n ja criado (`useLanguage()` + `t(key)`).

### Componentes a Traduzir

**Paginas:**
1. `Home.tsx` - saudacoes, banners de trial/inativo, titulos de secoes, stats, CTA de upgrade
2. `Projects.tsx` - titulo, acoes (renomear, excluir), dialogs, toasts
3. `Gallery.tsx` - titulo, selecao, confirmacao de exclusao, viewer inline
4. `Library.tsx` - titulo, filtros, mensagens de locked/upgrade
5. `ResetPassword.tsx` - formularios, mensagens de sucesso/erro
6. `Editor.tsx` - toasts de geracao, erros, otimizacao de projeto

**Nodes do Editor:**
7. `PromptNode.tsx` - label, subtitle, menu dropdown
8. `MediaNode.tsx` - label, subtitle, tabs, upload, toasts
9. `ResultNode.tsx` - label, subtitle, proporcao, quantidade, botao gerar, creditos
10. `OutputNode.tsx` - label, subtitle, botoes
11. `SettingsNode.tsx` - label, subtitle, proporcao, quantidade, botao gerar, creditos
12. `GravityNode.tsx` - label, menu, confirmacao, botao gerar todos
13. `GravityPopup.tsx` - titulo, labels, placeholder, botoes
14. `OutputImageModal.tsx` - titulo, botoes, metadata
15. `LibraryModal.tsx` - titulo, busca, mensagens

**Modais:**
16. `BuyCreditsModal.tsx` - titulo, toggle, planos, features, botoes, textos de pagamento
17. `CreateProjectModal.tsx` - titulo, opcoes, botoes
18. `EditProfileModal.tsx` - titulo, labels, botoes, toasts
19. `SubmitToLibraryModal.tsx` - titulo, labels, instrucoes, botoes, mensagem de sucesso
20. `WelcomeVideoModal.tsx` - titulo, descricao, botao
21. `ImageViewerModal.tsx` - labels, botoes, contribuicao
22. `SaveAsTemplateModal.tsx` - titulo, labels, tabs, botoes

### Detalhes Tecnicos

**Para cada componente:**
- Importar `useLanguage` de `@/contexts/LanguageContext`
- Chamar `const { t } = useLanguage()` no inicio do componente
- Substituir cada string hardcoded por `t('chave.correspondente')`
- Para nodes memo (PromptNode, MediaNode, etc), usar `useLanguage()` dentro do componente memo

**Chaves de traducao a adicionar nos 3 arquivos (pt.ts, en.ts, es.ts):**
- Aproximadamente 80-100 chaves novas cobrindo os componentes listados acima
- As chaves ja criadas na primeira fase (header, auth, footer, etc) continuam inalteradas

**Formatacao de datas:**
- Nos componentes que usam `date-fns` com `locale: ptBR`, trocar dinamicamente para o locale correspondente ao idioma selecionado:
  - `pt` -> `ptBR`
  - `en` -> `enUS` 
  - `es` -> `es` (locale do date-fns)

**Textos com variaveis (interpolacao):**
- Strings como `"Seu plano {plan} permite ate {max} projeto(s)"` serao mantidas com placeholders e substituidas via `.replace()` no ponto de uso
- Exemplo: `t('home.project_limit_desc').replace('{plan}', tierConfig.label).replace('{max}', String(tierConfig.maxProjects))`

### Volume de Alteracoes

- **3 arquivos de traducao** modificados (adicionar ~100 chaves cada)
- **~22 componentes** modificados (importar useLanguage + substituir strings)
- Nenhum arquivo novo criado
