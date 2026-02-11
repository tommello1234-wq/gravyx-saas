import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting for email actions
const emailRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkEmailRateLimit(email: string, maxPerHour: number = 5): boolean {
  const now = Date.now();
  const limit = emailRateLimits.get(email);

  if (!limit || now > limit.resetAt) {
    emailRateLimits.set(email, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (limit.count >= maxPerHour) {
    return false;
  }

  limit.count++;
  return true;
}

// In-memory rate limiting for admin actions per admin user
const adminActionLimits = new Map<string, { count: number; resetAt: number }>();

function checkAdminActionRateLimit(adminId: string, maxPerMinute: number = 10): boolean {
  const now = Date.now();
  const limit = adminActionLimits.get(adminId);

  if (!limit || now > limit.resetAt) {
    adminActionLimits.set(adminId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= maxPerMinute) {
    return false;
  }

  limit.count++;
  return true;
}

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

    // Rate limit admin actions (10 per minute per admin)
    if (!checkAdminActionRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, email } = await req.json();

    // Validate action
    const validActions = ["resend-invite", "delete-user", "dashboard-stats"];
    if (!action || !validActions.includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format when needed
    if (action === "resend-invite") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || typeof email !== 'string' || !emailRegex.test(email) || email.length > 255) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate userId when needed
    if (action === "delete-user") {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userId || typeof userId !== 'string' || !uuidRegex.test(userId)) {
        return new Response(JSON.stringify({ error: "Invalid userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "resend-invite") {
      // Rate limit email sends (5 per hour per email address)
      if (!checkEmailRateLimit(email)) {
        return new Response(JSON.stringify({ error: "Email rate limit exceeded. Max 5 per hour per address." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
            from: "Gravyx <noreply@upwardacademy.com.br>",
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

    if (action === "dashboard-stats") {
      // Fetch all users from auth to get last_sign_in_at
      const allUsers: Record<string, { last_sign_in_at: string | null }> = {};
      let page = 1;
      const perPage = 1000;
      
      while (true) {
        const { data: { users: authUsersList }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        
        if (listError) {
          console.error("Error listing users:", listError);
          break;
        }
        
        for (const u of authUsersList) {
          allUsers[u.id] = { last_sign_in_at: u.last_sign_in_at || null };
        }
        
        if (authUsersList.length < perPage) break;
        page++;
      }

      return new Response(JSON.stringify({ success: true, users: allUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
