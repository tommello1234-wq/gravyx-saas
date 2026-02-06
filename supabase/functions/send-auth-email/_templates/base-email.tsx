import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface BaseEmailProps {
  previewText: string
  heading: string
  children: React.ReactNode
}

export const BaseEmail = ({ previewText, heading, children }: BaseEmailProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Logo/Brand */}
        <Section style={logoSection}>
          <Text style={brandName}>✨ Node Artistry</Text>
        </Section>
        
        <Section style={contentSection}>
          <Heading style={h1}>{heading}</Heading>
          {children}
        </Section>
        
        <Hr style={hr} />
        
        <Section style={footerSection}>
          <Text style={footer}>
            © 2024 Node Artistry. Todos os direitos reservados.
          </Text>
          <Text style={footerLinks}>
            <Link href="https://node-artistry-12.lovable.app" style={footerLink}>
              Visitar site
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

// Styles
const main = {
  backgroundColor: '#0a0a0f',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
}

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const brandName = {
  fontSize: '28px',
  fontWeight: 'bold',
  background: 'linear-gradient(135deg, #a855f7, #6366f1)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  color: '#a855f7', // Fallback for email clients that don't support gradients
  margin: '0',
}

const contentSection = {
  backgroundColor: '#1a1a24',
  borderRadius: '16px',
  padding: '40px 32px',
  border: '1px solid rgba(168, 85, 247, 0.2)',
}

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}

const hr = {
  borderColor: 'rgba(255, 255, 255, 0.1)',
  margin: '32px 0',
}

const footerSection = {
  textAlign: 'center' as const,
}

const footer = {
  color: '#666',
  fontSize: '12px',
  margin: '0 0 8px',
}

const footerLinks = {
  margin: '0',
}

const footerLink = {
  color: '#a855f7',
  fontSize: '12px',
  textDecoration: 'none',
}

export default BaseEmail

// Shared styles for child components
export const sharedStyles = {
  text: {
    color: '#d1d5db',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 16px',
    textAlign: 'center' as const,
  },
  button: {
    backgroundColor: '#a855f7',
    borderRadius: '9999px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: 'bold',
    padding: '14px 32px',
    textDecoration: 'none',
    textAlign: 'center' as const,
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '24px 0',
  },
  code: {
    display: 'inline-block',
    padding: '16px 24px',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    color: '#a855f7',
    fontSize: '24px',
    fontWeight: 'bold',
    letterSpacing: '4px',
  },
  smallText: {
    color: '#666',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '16px 0 0',
    textAlign: 'center' as const,
  },
}
