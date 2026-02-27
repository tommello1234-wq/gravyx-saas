

## Vulnerabilidade: `profiles_user_update` sem restrição de colunas

### Como o atacante explorou

A policy `profiles_user_update` permite que qualquer usuário autenticado atualize **QUALQUER coluna** do próprio perfil:

```sql
-- POLICY ATUAL (VULNERÁVEL)
Policy: profiles_user_update
Command: UPDATE
Using: (SELECT auth.uid() AS uid) = user_id
With Check: (SELECT auth.uid() AS uid) = user_id
```

O atacante simplesmente abriu o console do navegador e executou:

```javascript
const { data, error } = await supabase
  .from('profiles')
  .update({ 
    tier: 'enterprise', 
    credits: 7180, 
    subscription_status: 'active',
    billing_cycle: 'annual'
  })
  .eq('user_id', '<seu-proprio-id>')
```

Sem nenhuma restrição de colunas na policy, o Postgres aceita o UPDATE normalmente.

### Plano de Correção

**1. Substituir a policy `profiles_user_update` para restringir colunas sensíveis**

Criar uma nova policy que permite UPDATE apenas em colunas seguras (`display_name`, `avatar_url`, `has_seen_onboarding`), bloqueando `tier`, `credits`, `subscription_status`, `billing_cycle`, `max_projects`, `asaas_subscription_id`.

A abordagem: usar um trigger `BEFORE UPDATE` que rejeita mudanças em colunas protegidas quando o caller não é service_role.

```sql
-- 1. Criar função que bloqueia alterações em campos sensíveis
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se é service_role (auth.uid() IS NULL), permite tudo
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se é admin, permite tudo
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Bloqueia alterações em campos sensíveis para usuários normais
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'Cannot modify tier';
  END IF;
  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    RAISE EXCEPTION 'Cannot modify credits';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot modify subscription_status';
  END IF;
  IF NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle THEN
    RAISE EXCEPTION 'Cannot modify billing_cycle';
  END IF;
  IF NEW.max_projects IS DISTINCT FROM OLD.max_projects THEN
    RAISE EXCEPTION 'Cannot modify max_projects';
  END IF;
  IF NEW.asaas_subscription_id IS DISTINCT FROM OLD.asaas_subscription_id THEN
    RAISE EXCEPTION 'Cannot modify asaas_subscription_id';
  END IF;
  IF NEW.total_generations IS DISTINCT FROM OLD.total_generations THEN
    RAISE EXCEPTION 'Cannot modify total_generations';
  END IF;
  IF NEW.trial_credits_given IS DISTINCT FROM OLD.trial_credits_given THEN
    RAISE EXCEPTION 'Cannot modify trial_credits_given';
  END IF;
  IF NEW.trial_start_date IS DISTINCT FROM OLD.trial_start_date THEN
    RAISE EXCEPTION 'Cannot modify trial_start_date';
  END IF;
  IF NEW.user_level IS DISTINCT FROM OLD.user_level THEN
    RAISE EXCEPTION 'Cannot modify user_level';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Cannot modify email';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Criar o trigger
CREATE TRIGGER protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
```

**2. Verificar se o usuário já foi deletado**

Nos auth logs, o user `0fa55b32-b66a-4e99-9fdb-0685d87cd402` (lulu22@teacher.semar.edu.pl) já foi deletado via `user_deleted` action pelo admin. Confirmado.

### Arquivos impactados

Nenhuma alteração de código frontend necessária. A correção é 100% no banco de dados (trigger).

### Resultado

Após o trigger, qualquer tentativa de um usuário comum alterar `tier`, `credits`, `subscription_status` etc. via client SDK será rejeitada com erro. Apenas service_role (Edge Functions) e admins poderão modificar esses campos.
