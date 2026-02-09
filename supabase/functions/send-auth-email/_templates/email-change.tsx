import {
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface EmailChangeEmailProps {
  confirmationUrl: string
  token?: string
  newEmail?: string
}

export const EmailChangeEmail = ({ confirmationUrl, token, newEmail }: EmailChangeEmailProps) => (
  <BaseLayout preview="Confirme a alteração do seu email no Gravyx.">
    <Text style={styles.title}>
      Confirmar Novo Email 📧
    </Text>
    
    <Text style={styles.text}>
      Você solicitou a alteração do email da sua conta no Gravyx
      {newEmail && (
        <> para <strong style={{ color: '#00b8ff' }}>{newEmail}</strong></>
      )}
      . Clique no botão abaixo para confirmar esta alteração.
    </Text>

    <Link href={confirmationUrl} style={styles.button}>
      Confirmar Alteração
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
      Se você não solicitou esta alteração, sua conta pode estar comprometida. Entre em contato conosco imediatamente.
    </Text>
  </BaseLayout>
)

export default EmailChangeEmail
