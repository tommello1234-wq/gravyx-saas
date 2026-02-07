import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDITS_PER_IMAGE = 1;

// Helper: Upload base64 image to Supabase Storage and return public URL
async function uploadBase64ToStorage(
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  base64DataUrl: string,
  userId: string,
  fileName: string
): Promise<string | null> {
  try {
    // Extract base64 data from data URL (format: data:image/png;base64,xxxxx)
    const matches = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      console.error("Invalid base64 data URL format");
      return null;
    }
    
    const imageType = matches[1]; // png, jpeg, etc.
    const base64Data = matches[2];
    
    // Decode base64 to Uint8Array
    const imageBytes = base64Decode(base64Data);
    
    // Create file path: userId/timestamp-random.ext
    const filePath = `${userId}/${fileName}.${imageType}`;
    
    // Upload to Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('generations')
      .upload(filePath, imageBytes, {
        contentType: `image/${imageType}`,
        upsert: false
      });
    
    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('generations')
      .getPublicUrl(filePath);
    
    console.log(`Uploaded image to Storage: ${filePath}`);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading to storage:", error);
    return null;
  }
}

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
    const { error: updateError } = await supabaseAdmin
      .rpc('decrement_credits', { uid: user.id, amount: creditsNeeded });

    if (updateError) {
      console.error("Error decrementing credits:", updateError);
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - creditsNeeded })
        .eq('user_id', user.id);
    }

    console.log(`Generating ${safeQuantity} image(s) for user ${user.id}, costing ${creditsNeeded} credits`);

    let fullPrompt = prompt;
    if (aspectRatio) {
      fullPrompt = `${prompt}. Aspect ratio: ${aspectRatio}`;
    }

    // Build message content
    const messageContent: { type: string; text?: string; image_url?: { url: string } }[] = [
      { type: "text", text: fullPrompt }
    ];
    
    for (const url of imageUrls) {
      messageContent.push({
        type: "image_url",
        image_url: { url }
      });
    }

    // Function to generate a single image and upload to Storage
    const generateSingleImage = async (index: number): Promise<string | null> => {
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
        const base64Url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!base64Url) {
          console.error("No image URL in response");
          return null;
        }

        // Upload to Storage instead of storing base64 directly
        const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;
        const publicUrl = await uploadBase64ToStorage(supabaseAdmin, base64Url, user.id, fileName);
        
        if (!publicUrl) {
          console.error("Failed to upload image to storage");
          return null;
        }

        return publicUrl;
      } catch (error) {
        console.error("Single image generation error:", error);
        if (error instanceof Error && error.message === "RATE_LIMIT") {
          throw error;
        }
        return null;
      }
    };

    // Generate images in parallel
    const generationPromises = Array(safeQuantity).fill(null).map((_, i) => generateSingleImage(i));
    
    let results: (string | null)[];
    try {
      results = await Promise.all(generationPromises);
    } catch (error) {
      // Refund all credits on rate limit
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

    // Filter successful generations
    const successfulImages = results.filter((url): url is string => url !== null);
    const failedCount = safeQuantity - successfulImages.length;

    // Refund credits for failed generations
    if (failedCount > 0) {
      const refundAmount = failedCount * CREDITS_PER_IMAGE;
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - creditsNeeded + refundAmount })
        .eq('user_id', user.id);
      console.log(`Refunded ${refundAmount} credits for ${failedCount} failed generation(s)`);
    }

    // If all failed
    if (successfulImages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Image generation failed", images: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save successful generations to database (now storing Storage URLs, not base64!)
    const generationInserts = successfulImages.map(imageUrl => ({
      user_id: user.id,
      project_id: projectId,
      prompt: prompt,
      aspect_ratio: aspectRatio || '1:1',
      image_url: imageUrl, // This is now a Storage URL, not base64!
      status: 'completed',
      saved_to_gallery: true
    }));

    await supabaseAdmin.from('generations').insert(generationInserts);

    console.log(`Generated ${successfulImages.length}/${safeQuantity} images for user ${user.id} (stored in Storage)`);

    // Get updated credits
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    return new Response(
      JSON.stringify({ 
        images: successfulImages, 
        creditsRemaining: updatedProfile?.credits ?? profile.credits - (successfulImages.length * CREDITS_PER_IMAGE),
        generatedCount: successfulImages.length,
        requestedCount: safeQuantity
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
