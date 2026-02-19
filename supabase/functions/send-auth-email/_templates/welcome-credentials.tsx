import {
  Text,
  Link,
  Hr,
  Section,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface WelcomeCredentialsEmailProps {
  email: string
  password: string
  loginUrl: string
}

export const WelcomeCredentialsEmail = ({ email, password, loginUrl }: WelcomeCredentialsEmailProps) => (
  <BaseLayout preview="Sua conta Gravyx foi criada! Acesse com suas credenciais.">
    <Text style={styles.title}>
      Sua conta foi criada! 🎉
    </Text>
    
    <Text style={styles.text}>
      Você adquiriu um plano no Gravyx e criamos sua conta automaticamente. Use as credenciais abaixo para acessar a plataforma:
    </Text>

    <Section style={credentialBox}>
      <Text style={credentialLabel}>📧 Email de acesso</Text>
      <Text style={credentialValue}>{email}</Text>
    </Section>

    <Section style={credentialBox}>
      <Text style={credentialLabel}>🔑 Senha de acesso</Text>
      <Text style={credentialValueHighlight}>{password}</Text>
    </Section>

    <Section style={warningBox}>
      <Text style={warningText}>
        ⚠️ Esta é uma senha padrão. Recomendamos que você a troque após o primeiro acesso em Configurações {'>'} Alterar Senha.
      </Text>
    </Section>

    <Link href={loginUrl} style={styles.button}>
      Acessar o Gravyx
    </Link>

    <Hr style={styles.hr} />

    <Text style={styles.disclaimer}>
      Se você não realizou esta compra, entre em contato com nosso suporte.
    </Text>
  </BaseLayout>
)

const credentialBox: React.CSSProperties = {
  backgroundColor: colors.background,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '12px',
}

const credentialLabel: React.CSSProperties = {
  color: colors.muted,
  fontSize: '13px',
  margin: '0 0 4px 0',
}

const credentialValue: React.CSSProperties = {
  color: colors.text,
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
}

const credentialValueHighlight: React.CSSProperties = {
  color: colors.primary,
  fontSize: '20px',
  fontWeight: 'bold',
  letterSpacing: '2px',
  margin: '0',
}

const warningBox: React.CSSProperties = {
  backgroundColor: 'rgba(251, 191, 36, 0.1)',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '16px 0 24px 0',
}

const warningText: React.CSSProperties = {
  color: '#fbbf24',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  textAlign: 'center' as const,
}

export default WelcomeCredentialsEmail
