import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { ConfirmationEmail } from './_templates/confirmation.tsx'
import { RecoveryEmail } from './_templates/recovery.tsx'
import { MagicLinkEmail } from './_templates/magic-link.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  
  console.log('Received auth email webhook')
  
  try {
    const wh = new Webhook(hookSecret)
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    console.log(`Processing ${email_action_type} email for ${user.email}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    let html: string
    let subject: string

    switch (email_action_type) {
      case 'signup':
      case 'email_confirmation':
        const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
        html = await renderAsync(
          React.createElement(ConfirmationEmail, { confirmationUrl })
        )
        subject = 'Confirme seu email - Node Artistry'
        break

      case 'recovery':
        const recoveryUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
        html = await renderAsync(
          React.createElement(RecoveryEmail, { recoveryUrl })
        )
        subject = 'Redefinir senha - Node Artistry'
        break

      case 'magiclink':
        const magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
        html = await renderAsync(
          React.createElement(MagicLinkEmail, { magicLinkUrl, token })
        )
        subject = 'Seu link de acesso - Node Artistry'
        break

      default:
        console.log(`Unknown email action type: ${email_action_type}`)
        return new Response(
          JSON.stringify({ error: `Unknown email action type: ${email_action_type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
    }

    const { error } = await resend.emails.send({
      from: 'Node Artistry <noreply@resend.dev>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    console.log(`Successfully sent ${email_action_type} email to ${user.email}`)

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error) {
    console.error('Error processing auth email:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})
