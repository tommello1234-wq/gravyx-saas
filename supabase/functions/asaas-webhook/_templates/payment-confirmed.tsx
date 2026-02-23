import * as React from 'npm:react@18.3.1'
import { Text, Link, Hr } from 'npm:@react-email/components@0.0.22'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface PaymentConfirmedEmailProps {
  tierName: string
  credits: number
  cycle: string
}

const highlightBox = {
  backgroundColor: colors.background,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const highlightLabel = {
  color: colors.muted,
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 4px 0',
  textAlign: 'center' as const,
}

const highlightValue = {
  color: colors.primary,
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const,
}

export const PaymentConfirmedEmail = ({ tierName, credits, cycle }: PaymentConfirmedEmailProps) => (
  <BaseLayout preview={`Pagamento confirmado! ${credits} créditos adicionados ao seu plano ${tierName}.`}>
    <Text style={styles.title}>Pagamento Confirmado! ✅</Text>
    <Text style={styles.text}>
      Seu plano <strong style={{ color: colors.text }}>{tierName} ({cycle === 'annual' ? 'Anual' : 'Mensal'})</strong> foi ativado com sucesso.
    </Text>

    <div style={highlightBox}>
      <Text style={highlightLabel}>Créditos adicionados</Text>
      <Text style={highlightValue}>{credits} créditos</Text>
    </div>

    <Hr style={styles.hr} />

    <Text style={styles.text}>
      Seus créditos já estão disponíveis. Comece a criar agora!
    </Text>

    <Link href="https://app.gravyx.com.br/projects" style={styles.button}>
      Acessar Gravyx 🚀
    </Link>
  </BaseLayout>
)

export default PaymentConfirmedEmail
