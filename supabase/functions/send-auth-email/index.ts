import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { WelcomeEmail } from './_templates/welcome.tsx'
import { MagicLinkEmail } from './_templates/magic-link.tsx'
import { PasswordResetEmail } from './_templates/password-reset.tsx'
import { EmailChangeEmail } from './_templates/email-change.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

// Hook secret pode vir com prefixo "v1," - remover se presente
const rawHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string
const hookSecret = rawHookSecret?.startsWith('v1,') 
  ? rawHookSecret.substring(3) 
  : rawHookSecret

console.log('[send-auth-email] Function initialized')

interface EmailPayload {
  user: {
    email: string
    user_metadata?: {
      full_name?: string
    }
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    console.log('[send-auth-email] Method not allowed:', req.method)
    return new Response('Method not allowed', { status: 405 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  
  console.log('[send-auth-email] Received webhook request')

  const wh = new Webhook(hookSecret)
  
  try {
    // Verificar assinatura do webhook
    const {
      user,
      email_data: { 
        token, 
        token_hash, 
        redirect_to, 
        email_action_type,
        site_url,
        token_new,
        token_hash_new
      },
    } = wh.verify(payload, headers) as EmailPayload

    console.log('[send-auth-email] Verified webhook for:', user.email, 'type:', email_action_type)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    
    let html: string
    let subject: string

    // Construir URL base para ações
    const baseRedirectUrl = redirect_to || site_url || 'https://node-artistry-12.lovable.app'

    switch (email_action_type) {
      case 'signup': {
        const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=signup&redirect_to=${baseRedirectUrl}`
        html = await renderAsync(
          React.createElement(WelcomeEmail, {
            confirmationUrl,
            token,
          })
        )
        subject = 'Bem-vindo ao Avion! Confirme seu email 🎉'
        break
      }

      case 'magiclink': {
        const magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=magiclink&redirect_to=${baseRedirectUrl}`
        html = await renderAsync(
          React.createElement(MagicLinkEmail, {
            magicLinkUrl,
            token,
          })
        )
        subject = 'Seu link de acesso ao Avion ✨'
        break
      }

      case 'recovery': {
        const resetUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=recovery&redirect_to=${baseRedirectUrl}`
        html = await renderAsync(
          React.createElement(PasswordResetEmail, {
            resetUrl,
            token,
          })
        )
        subject = 'Redefinir sua senha do Avion 🔐'
        break
      }

      case 'email_change': {
        const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=email_change&redirect_to=${baseRedirectUrl}`
        html = await renderAsync(
          React.createElement(EmailChangeEmail, {
            confirmationUrl,
            token,
          })
        )
        subject = 'Confirme seu novo email no Avion 📧'
        break
      }

      default:
        console.log('[send-auth-email] Unknown email type:', email_action_type)
        return new Response(
          JSON.stringify({ error: { message: `Unknown email type: ${email_action_type}` } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    console.log('[send-auth-email] Sending email to:', user.email, 'subject:', subject)

    const { error } = await resend.emails.send({
      from: 'Avion <noreply@upwardacademy.com.br>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('[send-auth-email] Resend error:', error)
      throw error
    }

    console.log('[send-auth-email] Email sent successfully to:', user.email)

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[send-auth-email] Error:', error.message || error)
    
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message || 'Internal server error',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
