import {
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseLayout, styles, colors } from './base-layout.tsx'

interface MagicLinkEmailProps {
  magicLinkUrl: string
}

export const MagicLinkEmail = ({ magicLinkUrl }: MagicLinkEmailProps) => (
  <BaseLayout preview="Seu link de acesso ao Gravyx está aqui! Clique para entrar.">
    <Text style={styles.title}>
      Acesse sua conta ✨
    </Text>
    
    <Text style={styles.text}>
      Você solicitou um link mágico para entrar no Gravyx. Clique no botão abaixo para acessar sua conta instantaneamente.
    </Text>

    <Link href={magicLinkUrl} style={styles.button}>
      Entrar no Gravyx
    </Link>

    <Hr style={styles.hr} />

    <Text style={styles.disclaimer}>
      Este link expira em 1 hora. Se você não solicitou este acesso, pode ignorar este email.
    </Text>
  </BaseLayout>
)

export default MagicLinkEmail
