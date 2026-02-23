

## Desativar E-mails do Asaas e Enviar via Resend

### Objetivo
Parar de pagar R$0,99 por e-mail do Asaas, desativando as notificacoes automaticas e enviando e-mails transacionais de pagamento pelo Resend (que voce ja usa para os e-mails de autenticacao).

### O que muda

1. **Desativar e-mails do Asaas** - Adicionar `notifications: { disabled: true }` nos payloads de cobranca e assinatura
2. **Criar templates de e-mail** para eventos de pagamento (confirmacao, boleto/PIX pendente, atraso)
3. **Enviar e-mails via Resend** no webhook quando o Asaas notificar os eventos

### Templates a criar

| Template | Quando envia | Conteudo |
|----------|-------------|----------|
| Pagamento Confirmado | `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | "Seu plano foi ativado! X creditos adicionados" |
| Pagamento Pendente (PIX) | Apos gerar QR code | "Escaneie o QR code para ativar seu plano" |
| Pagamento Atrasado | `PAYMENT_OVERDUE` | "Seu pagamento esta pendente, regularize para manter o acesso" |

### Arquivos a modificar

**1. `supabase/functions/process-asaas-payment/index.ts`**
- Adicionar `notifications: { disabled: true }` no payload de cobranca avulsa (anual + cartao)
- Adicionar `notifications: { disabled: true }` no payload de assinatura (mensal/anual)

**2. `supabase/functions/asaas-webhook/index.ts`**
- Importar Resend e React Email
- Apos ativar o plano em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, enviar e-mail de confirmacao com detalhes do plano e creditos
- Apos marcar `past_due` em `PAYMENT_OVERDUE`, enviar e-mail de lembrete de atraso
- Usar o email do perfil do usuario (ja disponivel no webhook)

**3. Criar templates de e-mail (novos arquivos)**

- `supabase/functions/asaas-webhook/_templates/base-layout.tsx` - Copiar o base-layout existente (mesmo visual)
- `supabase/functions/asaas-webhook/_templates/payment-confirmed.tsx` - Template de pagamento confirmado com nome do plano, creditos e botao "Acessar Gravyx"
- `supabase/functions/asaas-webhook/_templates/payment-overdue.tsx` - Template de pagamento atrasado com alerta e botao para regularizar

### Detalhes tecnicos

Os templates usarao a mesma estrutura visual (Blue Orbital) ja existente nos e-mails de autenticacao, reutilizando cores, estilos e layout do `BaseLayout`.

O webhook ja tem acesso ao `profile.email` do usuario, entao nao precisa de nenhuma consulta adicional ao banco.

O Resend ja esta configurado com a secret `RESEND_API_KEY` disponivel nas Edge Functions, enviando de `noreply@upwardacademy.com.br`.

Nenhuma mudanca no banco de dados -- apenas codigo.

