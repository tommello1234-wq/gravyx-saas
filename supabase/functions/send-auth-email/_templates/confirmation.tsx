import { Link, Text, Section } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, sharedStyles } from './base-email.tsx'

interface ConfirmationEmailProps {
  confirmationUrl: string
}

export const ConfirmationEmail = ({ confirmationUrl }: ConfirmationEmailProps) => (
  <BaseEmail
    previewText="Confirme seu email para ativar sua conta"
    heading="Confirme seu email"
  >
    <Text style={sharedStyles.text}>
      Bem-vindo ao Node Artistry! 🎨
    </Text>
    <Text style={sharedStyles.text}>
      Clique no botão abaixo para confirmar seu email e começar a criar imagens incríveis com IA.
    </Text>
    
    <Section style={sharedStyles.buttonContainer}>
      <Link href={confirmationUrl} style={sharedStyles.button}>
        Confirmar meu email
      </Link>
    </Section>
    
    <Text style={sharedStyles.smallText}>
      Se você não criou uma conta no Node Artistry, pode ignorar este email.
    </Text>
  </BaseEmail>
)

export default ConfirmationEmail
