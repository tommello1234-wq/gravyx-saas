import {
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface WelcomeEmailProps {
  confirmationUrl: string
  token?: string
}

export const WelcomeEmail = ({ confirmationUrl, token }: WelcomeEmailProps) => (
  <BaseLayout preview="Bem-vindo ao Avion! Confirme seu email para começar a criar imagens incríveis com IA.">
    <Text style={styles.title}>
      Bem-vindo ao Avion! 🎉
    </Text>
    
    <Text style={styles.text}>
      Estamos muito felizes em ter você! Confirme seu email para desbloquear o poder da geração de imagens com IA.
    </Text>

    <Link href={confirmationUrl} style={styles.button}>
      Confirmar Email
    </Link>

    {token && (
      <>
        <Hr style={styles.hr} />
        <Text style={{ ...styles.text, marginBottom: '8px' }}>
          Ou use este código de confirmação:
        </Text>
        <div style={styles.codeContainer}>
          <Text style={styles.code}>{token}</Text>
        </div>
      </>
    )}

    <Hr style={styles.hr} />

    <Text style={styles.disclaimer}>
      Se você não criou uma conta no Avion, pode ignorar este email com segurança.
    </Text>
  </BaseLayout>
)

export default WelcomeEmail
