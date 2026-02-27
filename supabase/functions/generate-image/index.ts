import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function creditsForResolution(resolution: string): number {
  switch (resolution) {
    case '4K': return 4;
    case '2K': return 2;
    default: return 1; // 1K
  }
}

// In-memory rate limiting per user (max 15 requests per minute)
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkUserRateLimit(userId: string, maxPerMinute: number = 15): boolean {
  const now = Date.now();
  const limit = userRateLimits.get(userId);

  if (!limit || now > limit.resetAt) {
    userRateLimits.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= maxPerMinute) {
    return false;
  }

  limit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: max 15 image generation requests per minute per user
    if (!checkUserRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before generating more images." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { prompt, aspectRatio, quantity = 1, imageUrls = [], references = [], projectId, resultId, resolution = '1K' } = await req.json();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validate projectId if provided
    if (projectId != null && (typeof projectId !== 'string' || !uuidRegex.test(projectId))) {
      return new Response(
        JSON.stringify({ error: "Invalid projectId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate resultId if provided
    if (resultId != null && (typeof resultId !== 'string' || resultId.length > 255)) {
      return new Response(
        JSON.stringify({ error: "Invalid resultId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Invalid prompt (must be a string, max 5000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate aspect ratio - all formats supported by Gemini 3.1
    // Empty/null = Auto mode (model decides from context)
    const validAspectRatios = ['1:1', '3:2', '2:3', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'];
    if (aspectRatio && !validAspectRatios.includes(aspectRatio)) {
      return new Response(
        JSON.stringify({ error: "Invalid aspect ratio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate imageUrls
    if (!Array.isArray(imageUrls) || imageUrls.length > 10) {
      return new Response(
        JSON.stringify({ error: "imageUrls must be an array with max 10 items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each imageUrl item
    for (const url of imageUrls) {
      if (typeof url !== 'string' || url.length > 2048 || !url.startsWith('https://')) {
        return new Response(
          JSON.stringify({ error: "Each imageUrl must be a valid HTTPS URL (max 2048 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate quantity (1, 2, or 4)
    const validQuantities = [1, 2, 3, 4, 5];
    const safeQuantity = validQuantities.includes(quantity) ? quantity : 1;

    // Validate resolution
    const validResolutions = ['1K', '2K', '4K'];
    const safeResolution = validResolutions.includes(resolution) ? resolution : '1K';

    // Validate references array (new enriched format)
    if (!Array.isArray(references) || references.length > 10) {
      return new Response(
        JSON.stringify({ error: "references must be an array with max 10 items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    for (const ref of references) {
      if (!ref || typeof ref.url !== 'string' || !ref.url.startsWith('https://') || ref.url.length > 2048) {
        return new Response(
          JSON.stringify({ error: "Each reference must have a valid HTTPS url" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check credits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditsNeeded = safeQuantity * creditsForResolution(safeResolution);
    if (profile.credits < creditsNeeded) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditsNeeded, available: profile.credits }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enqueuing job for ${safeQuantity} image(s) for user ${user.id}, credits available: ${profile.credits}, references: ${references.length}`);

    // Insert job into queue
    const { data: job, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert({
        user_id: user.id,
        project_id: projectId,
        status: 'queued',
        payload: {
          prompt,
          aspectRatio: aspectRatio || '',
          quantity: safeQuantity,
          imageUrls,
          references: references.map((r: { url: string; label?: string; libraryPrompt?: string; index?: number }) => ({
            url: r.url,
            label: (r.label || 'Mídia').slice(0, 100),
            libraryPrompt: r.libraryPrompt ? String(r.libraryPrompt).slice(0, 500) : undefined,
            index: r.index,
          })),
          resultId,
          resolution: safeResolution
        },
        max_retries: 3
      })
      .select('id')
      .single();

    if (insertError || !job) {
      console.error("Error inserting job:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to enqueue job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Job ${job.id} enqueued successfully`);

    // Return immediately with job info
    return new Response(
      JSON.stringify({ 
        jobId: job.id,
        status: 'queued',
        quantity: safeQuantity
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
