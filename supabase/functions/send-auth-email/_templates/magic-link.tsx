import { Link, Text, Section } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, sharedStyles } from './base-email.tsx'

interface MagicLinkEmailProps {
  magicLinkUrl: string
  token: string
}

export const MagicLinkEmail = ({ magicLinkUrl, token }: MagicLinkEmailProps) => (
  <BaseEmail
    previewText="Seu link de acesso ao Node Artistry"
    heading="Link de acesso"
  >
    <Text style={sharedStyles.text}>
      Clique no botão abaixo para acessar sua conta.
    </Text>
    
    <Section style={sharedStyles.buttonContainer}>
      <Link href={magicLinkUrl} style={sharedStyles.button}>
        Entrar na minha conta
      </Link>
    </Section>
    
    <Text style={sharedStyles.text}>
      Ou use este código de acesso:
    </Text>
    
    <Section style={sharedStyles.buttonContainer}>
      <code style={sharedStyles.code}>{token}</code>
    </Section>
    
    <Text style={sharedStyles.smallText}>
      Este link expira em 1 hora. Se você não solicitou este acesso, pode ignorar este email.
    </Text>
  </BaseEmail>
)

export default MagicLinkEmail
