import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDITS_PER_IMAGE = 1;

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

    const { prompt, aspectRatio, quantity = 1, imageUrls = [], projectId, resultId } = await req.json();

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Invalid prompt (must be a string, max 5000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate aspect ratio
    const validAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
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

    // Validate quantity (1, 2, or 4)
    const validQuantities = [1, 2, 4];
    const safeQuantity = validQuantities.includes(quantity) ? quantity : 1;

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

    const creditsNeeded = safeQuantity * CREDITS_PER_IMAGE;
    if (profile.credits < creditsNeeded) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditsNeeded, available: profile.credits }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits atomically
    const { data: newCredits, error: updateError } = await supabaseAdmin
      .rpc('decrement_credits', { uid: user.id, amount: creditsNeeded });

    if (updateError) {
      console.error("Error decrementing credits:", updateError);
      // Fallback to direct update
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - creditsNeeded })
        .eq('user_id', user.id);
    }

    const creditsAfterDeduction = typeof newCredits === 'number' ? newCredits : profile.credits - creditsNeeded;

    console.log(`Enqueuing job for ${safeQuantity} image(s) for user ${user.id}, deducted ${creditsNeeded} credits`);

    // Insert job into queue
    const { data: job, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert({
        user_id: user.id,
        project_id: projectId,
        status: 'queued',
        payload: {
          prompt,
          aspectRatio: aspectRatio || '1:1',
          quantity: safeQuantity,
          imageUrls,
          resultId
        },
        max_retries: 3
      })
      .select('id')
      .single();

    if (insertError || !job) {
      console.error("Error inserting job:", insertError);
      
      // Refund credits on failure
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits })
        .eq('user_id', user.id);
      
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
        quantity: safeQuantity,
        creditsDeducted: creditsNeeded,
        creditsRemaining: creditsAfterDeduction
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
