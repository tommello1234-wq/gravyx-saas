import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Import Supabase client dynamically
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

    const { prompt, aspectRatio, quantity = 1, imageUrls = [], projectId } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const creditsNeeded = quantity;
    if (profile.credits < creditsNeeded) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: creditsNeeded, available: profile.credits }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits
    await supabaseAdmin
      .from('profiles')
      .update({ credits: profile.credits - creditsNeeded })
      .eq('user_id', user.id);

    console.log(`Generating ${quantity} images in parallel for user ${user.id}`);

    let fullPrompt = prompt;
    if (aspectRatio) {
      fullPrompt = `${prompt}. Aspect ratio: ${aspectRatio}`;
    }

    // Build message content once (same for all parallel requests)
    const messageContent: { type: string; text?: string; image_url?: { url: string } }[] = [
      { type: "text", text: fullPrompt }
    ];
    
    for (const url of imageUrls) {
      messageContent.push({
        type: "image_url",
        image_url: { url }
      });
    }

    // Function to generate a single image
    const generateSingleImage = async (): Promise<string | null> => {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [{ role: "user", content: messageContent }],
            modalities: ["image", "text"]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AI Gateway error:", response.status, errorText);
          
          if (response.status === 429) {
            throw new Error("RATE_LIMIT");
          }
          
          return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
      } catch (error) {
        console.error("Single image generation error:", error);
        if (error instanceof Error && error.message === "RATE_LIMIT") {
          throw error;
        }
        return null;
      }
    };

    // Generate all images in parallel
    const promises = Array.from({ length: quantity }, () => generateSingleImage());
    
    let results: (string | null)[];
    try {
      results = await Promise.all(promises);
    } catch (error) {
      // Refund credits on rate limit
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits })
        .eq('user_id', user.id);
      
      if (error instanceof Error && error.message === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    const images = results.filter((url): url is string => url !== null);
    
    // Refund credits for failed generations
    const failedCount = quantity - images.length;
    if (failedCount > 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - images.length })
        .eq('user_id', user.id);
    }

    // Save all successful generations
    if (images.length > 0) {
      const generations = images.map(imageUrl => ({
        user_id: user.id,
        project_id: projectId,
        prompt: prompt,
        aspect_ratio: aspectRatio || '1:1',
        image_url: imageUrl,
        status: 'completed'
      }));
      
      await supabaseAdmin.from('generations').insert(generations);
    }

    console.log(`Generated ${images.length}/${quantity} images in parallel`);

    return new Response(
      JSON.stringify({ images, creditsRemaining: profile.credits - creditsNeeded }),
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
