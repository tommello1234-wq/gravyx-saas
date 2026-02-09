import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

// Cores do tema Gravyx - Blue Orbital
const colors = {
  background: '#0a0a14',
  card: '#0f0f1a',
  cardBorder: 'rgba(0, 135, 255, 0.15)',
  primary: '#00b8ff',
  secondary: '#0066ff',
  accent: '#3b82f6',
  text: '#fafafa',
  muted: '#71717a',
  gradientStart: '#00b8ff',
  gradientEnd: '#001eff',
}

const styles = {
  main: {
    backgroundColor: colors.background,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  },
  container: {
    margin: '0 auto',
    padding: '40px 20px',
    maxWidth: '600px',
  },
  logo: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: 'bold',
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: colors.primary,
    margin: '0',
  },
  logoIcon: {
    fontSize: '24px',
    marginRight: '8px',
  },
  card: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: '16px',
    padding: '32px',
    boxShadow: `0 0 40px rgba(0, 135, 255, 0.1)`,
  },
  title: {
    color: colors.text,
    fontSize: '24px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    margin: '0 0 16px 0',
  },
  text: {
    color: colors.muted,
    fontSize: '16px',
    lineHeight: '24px',
    textAlign: 'center' as const,
    margin: '0 0 24px 0',
  },
  button: {
    display: 'block',
    background: `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center' as const,
    padding: '14px 32px',
    borderRadius: '9999px',
    boxShadow: `0 0 20px rgba(0, 135, 255, 0.4)`,
    margin: '0 auto',
  },
  codeContainer: {
    backgroundColor: colors.background,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: '8px',
    padding: '16px',
    margin: '24px 0',
  },
  code: {
    color: colors.primary,
    fontSize: '24px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    letterSpacing: '4px',
    margin: '0',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '32px',
  },
  footerText: {
    color: colors.muted,
    fontSize: '12px',
    lineHeight: '20px',
    margin: '0',
  },
  footerLink: {
    color: colors.primary,
    textDecoration: 'none',
  },
  hr: {
    borderColor: colors.cardBorder,
    margin: '24px 0',
  },
  disclaimer: {
    color: colors.muted,
    fontSize: '14px',
    lineHeight: '22px',
    textAlign: 'center' as const,
    margin: '24px 0 0 0',
  },
}

interface BaseLayoutProps {
  preview: string
  children: React.ReactNode
}

export const BaseLayout = ({ preview, children }: BaseLayoutProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        {/* Logo Header */}
        <Section style={styles.logo}>
          <Text style={styles.logoText}>
            <span style={styles.logoIcon}>🚀</span>
            Gravyx
          </Text>
        </Section>

        {/* Card Content */}
        <Section style={styles.card}>
          {children}
        </Section>

        {/* Footer */}
        <Section style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Gravyx · Geração de Imagens com IA
          </Text>
          <Text style={styles.footerText}>
            <Link href="https://app.gravyx.com.br" style={styles.footerLink}>
              Acessar Gravyx
            </Link>
            {' · '}
            <Link href="https://app.gravyx.com.br" style={styles.footerLink}>
              Termos de Uso
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export { styles, colors }
export default BaseLayout
