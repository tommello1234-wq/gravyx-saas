

## Popup de Onboarding com Video Tutorial para Novos Usuarios

### Resumo
Criar um modal/popup que aparece automaticamente para usuarios que estao fazendo login pela primeira vez, exibindo um video do YouTube com instrucoes de como usar a plataforma.

### Como funciona

1. **Nova coluna no banco**: Adicionar `has_seen_onboarding` (boolean, default `false`) na tabela `profiles`
2. **Componente WelcomeVideoModal**: Um Dialog que exibe o video do YouTube embedado com o titulo solicitado
3. **Logica de exibicao**: Na pagina Home, verificar se `has_seen_onboarding` e `false` -- se sim, mostrar o modal
4. **Marcar como visto**: Quando o usuario fechar o modal, atualizar `has_seen_onboarding = true` no banco

### Detalhes tecnicos

**1. Migracao SQL**
- Adicionar coluna `has_seen_onboarding BOOLEAN DEFAULT FALSE` na tabela `profiles`

**2. Novo componente `src/components/WelcomeVideoModal.tsx`**
- Usa o componente `Dialog` existente do projeto
- Titulo: "Novo por aqui? Entenda rapidamente como voce pode criar sua primeira arte 100% com IA assistindo esse video"
- Iframe do YouTube embedando o video `https://www.youtube.com/embed/3_4t5VIHNkY`
- Botao "Entendi, vamos comecar!" para fechar
- Ao fechar (tanto pelo botao quanto pelo X), chama `supabase.from('profiles').update({ has_seen_onboarding: true })` para o usuario atual

**3. Integracao na pagina Home (`src/pages/Home.tsx`)**
- Importar o `WelcomeVideoModal`
- Controlar abertura com base em `profile?.has_seen_onboarding === false`
- Passar callback de fechamento que atualiza o perfil e faz `refreshProfile()`

**4. Atualizacao do AuthContext**
- Adicionar `has_seen_onboarding` na interface `Profile` para tipar corretamente

**5. Tipos Supabase**
- Serao atualizados automaticamente pela migracao

