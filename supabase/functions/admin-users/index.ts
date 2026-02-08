import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, email, credits } = await req.json();

    if (action === "create-user") {
      // Create a new user with email
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: false,
        user_metadata: { invited: true },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Set initial credits if provided
      if (credits && createData.user) {
        await supabaseAdmin
          .from("profiles")
          .update({ credits })
          .eq("user_id", createData.user.id);
      }

      // Generate magic link for the user
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
        options: {
          redirectTo: `${req.headers.get("origin") || supabaseUrl}/`,
        },
      });

      if (!linkError && linkData.properties?.action_link) {
        // Send the magic link email using Resend
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Node Artistry <noreply@upwardacademy.com.br>",
              to: [email],
              subject: "Bem-vindo à plataforma!",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Bem-vindo!</h2>
                  <p>Olá!</p>
                  <p>Você foi convidado para acessar a plataforma Node Artistry.</p>
                  <p>Clique no botão abaixo para acessar:</p>
                  <a href="${linkData.properties.action_link}" 
                     style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
                    Acessar Plataforma
                  </a>
                  <p style="color: #666; font-size: 14px;">Este link é válido por 24 horas.</p>
                </div>
              `,
            }),
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Usuário criado e convite enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resend-invite") {
      // Generate magic link for the user
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
        options: {
          redirectTo: `${req.headers.get("origin") || supabaseUrl}/`,
        },
      });

      if (error) {
        console.error("Error generating link:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send the magic link email using Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey && data.properties?.action_link) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Node Artistry <noreply@upwardacademy.com.br>",
            to: [email],
            subject: "Seu acesso à plataforma",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Acesso à Plataforma</h2>
                <p>Olá!</p>
                <p>Você recebeu um novo link de acesso à plataforma Node Artistry.</p>
                <p>Clique no botão abaixo para acessar:</p>
                <a href="${data.properties.action_link}" 
                   style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
                  Acessar Plataforma
                </a>
                <p style="color: #666; font-size: 14px;">Este link é válido por 24 horas.</p>
              </div>
            `,
          }),
        });

        if (!emailRes.ok) {
          const emailError = await emailRes.text();
          console.error("Error sending email:", emailError);
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Convite reenviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-user") {
      // Delete user from auth (this will cascade to profiles due to trigger)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error("Error deleting user:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Usuário removido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
