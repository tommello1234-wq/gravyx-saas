

## Atualizar perfil do usuário socials@gtss.io para Premium

### O que sera feito
Executar um comando SQL para atualizar o perfil do usuario `socials@gtss.io` com as seguintes alteracoes:

- **Tier**: free -> premium
- **Creditos**: 5 -> 250
- **Ciclo de cobranca**: monthly -> annual
- **Max projetos**: 1 -> 999 (ilimitado para premium)

### Detalhes tecnicos
- Sera utilizado o insert tool do Supabase para executar um `UPDATE` na tabela `profiles`
- O usuario alvo tem `user_id = 4da0ef13-3bbb-41ae-b1a3-0eda34db6608`
- O campo `updated_at` sera atualizado para `now()`
- Os valores respeitam a constraint `profiles_tier_check` (free, starter, premium, enterprise) e `validate_billing_cycle` (monthly, annual)

