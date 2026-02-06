import { Link, Text, Section } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, sharedStyles } from './base-email.tsx'

interface RecoveryEmailProps {
  recoveryUrl: string
}

export const RecoveryEmail = ({ recoveryUrl }: RecoveryEmailProps) => (
  <BaseEmail
    previewText="Redefina sua senha do Node Artistry"
    heading="Redefinir senha"
  >
    <Text style={sharedStyles.text}>
      Você solicitou a redefinição da sua senha.
    </Text>
    <Text style={sharedStyles.text}>
      Clique no botão abaixo para criar uma nova senha. Este link expira em 1 hora.
    </Text>
    
    <Section style={sharedStyles.buttonContainer}>
      <Link href={recoveryUrl} style={sharedStyles.button}>
        Redefinir minha senha
      </Link>
    </Section>
    
    <Text style={sharedStyles.smallText}>
      Se você não solicitou a redefinição de senha, pode ignorar este email com segurança.
    </Text>
  </BaseEmail>
)

export default RecoveryEmail
