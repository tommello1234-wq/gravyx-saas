import * as React from 'npm:react@18.3.1'
import { Text, Link, Hr } from 'npm:@react-email/components@0.0.22'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface PaymentOverdueEmailProps {
  tierName: string
}

const warningBox = {
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const warningText = {
  color: '#fca5a5',
  fontSize: '14px',
  lineHeight: '22px',
  textAlign: 'center' as const,
  margin: '0',
}

export const PaymentOverdueEmail = ({ tierName }: PaymentOverdueEmailProps) => (
  <BaseLayout preview={`Seu pagamento do plano ${tierName} está pendente. Regularize para manter o acesso.`}>
    <Text style={styles.title}>Pagamento Pendente ⚠️</Text>
    <Text style={styles.text}>
      O pagamento do seu plano <strong style={{ color: colors.text }}>{tierName}</strong> não foi identificado.
    </Text>

    <div style={warningBox}>
      <Text style={warningText}>
        Regularize o pagamento para continuar utilizando todos os recursos do seu plano sem interrupções.
      </Text>
    </div>

    <Hr style={styles.hr} />

    <Text style={styles.text}>
      Se já realizou o pagamento, por favor aguarde alguns minutos para o processamento.
    </Text>

    <Link href="https://app.gravyx.com.br/projects" style={styles.button}>
      Acessar Gravyx
    </Link>
  </BaseLayout>
)

export default PaymentOverdueEmail
