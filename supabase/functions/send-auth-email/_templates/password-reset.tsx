import {
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface PasswordResetEmailProps {
  resetUrl: string
  token?: string
}

export const PasswordResetEmail = ({ resetUrl, token }: PasswordResetEmailProps) => (
  <BaseLayout preview="Redefina sua senha do Gravyx de forma segura.">
    <Text style={styles.title}>
      Redefinir Senha 🔐
    </Text>
    
    <Text style={styles.text}>
      Recebemos uma solicitação para redefinir a senha da sua conta no Gravyx. Clique no botão abaixo para criar uma nova senha.
    </Text>

    <Link href={resetUrl} style={styles.button}>
      Redefinir Senha
    </Link>

    {token && (
      <>
        <Hr style={styles.hr} />
        <Text style={{ ...styles.text, marginBottom: '8px' }}>
          Ou use este código de verificação:
        </Text>
        <div style={styles.codeContainer}>
          <Text style={styles.code}>{token}</Text>
        </div>
      </>
    )}

    <Hr style={styles.hr} />

    <Text style={styles.disclaimer}>
      Este link expira em 1 hora. Se você não solicitou a redefinição de senha, ignore este email — sua senha permanecerá inalterada.
    </Text>
  </BaseLayout>
)

export default PasswordResetEmail
