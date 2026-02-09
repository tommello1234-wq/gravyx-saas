import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDITS_PER_IMAGE = 1;
const MAX_RETRIES = 3;

// Backoff delays in milliseconds: 5s, 10s, 20s
const BACKOFF_DELAYS = [5000, 10000, 20000];

// Helper: Upload base64 image to Supabase Storage and return public URL
async function uploadBase64ToStorage(
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  base64DataUrl: string,
  userId: string,
  fileName: string
): Promise<string | null> {
  try {
    const matches = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      console.error("Invalid base64 data URL format");
      return null;
    }
    
    const imageType = matches[1];
    const base64Data = matches[2];
    const imageBytes = base64Decode(base64Data);
    const filePath = `${userId}/${fileName}.${imageType}`;
    
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

// Generate a single image via AI Gateway
async function generateSingleImage(
  LOVABLE_API_KEY: string,
  messageContent: { type: string; text?: string; image_url?: { url: string } }[],
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  userId: string,
  index: number
): Promise<string | null> {
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

    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;
    const publicUrl = await uploadBase64ToStorage(supabaseAdmin, base64Url, userId, fileName);
    
    if (!publicUrl) {
      console.error("Failed to upload image to storage");
      return null;
    }

    return publicUrl;
  } catch (error) {
    console.error("Single image generation error:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Authenticate: accept either WORKER_SECRET or valid user JWT
  const WORKER_SECRET = Deno.env.get("WORKER_SECRET");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  let isAuthenticated = false;

  // Check worker secret first
  if (WORKER_SECRET && token === WORKER_SECRET) {
    isAuthenticated = true;
  }

  // Fallback: validate as user JWT
  if (!isAuthenticated && token) {
    const { createClient: createAuthClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabaseAuth = createAuthClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (!authError && user) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Claim the next available job
    const { data: job, error: claimError } = await supabaseAdmin.rpc('claim_next_job', {
      p_worker_id: crypto.randomUUID()
    });
    
    if (claimError) {
      console.error("Error claiming job:", claimError);
      return new Response(
        JSON.stringify({ error: "Failed to claim job", details: claimError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No job available
    if (!job || (Array.isArray(job) && job.length === 0)) {
      return new Response(
        JSON.stringify({ message: "No jobs available" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle array response (claim_next_job returns SETOF)
    const claimedJob = Array.isArray(job) ? job[0] : job;
    
    console.log(`Processing job ${claimedJob.id} for user ${claimedJob.user_id}`);

    // Extract payload
    const payload = claimedJob.payload as {
      prompt: string;
      aspectRatio: string;
      quantity: number;
      imageUrls: string[];
      resultId?: string;
    };

    const { prompt, aspectRatio, quantity, imageUrls = [], resultId } = payload;

    // Build message content for AI
    let fullPrompt = prompt;
    if (aspectRatio) {
      fullPrompt = `${prompt}. Aspect ratio: ${aspectRatio}`;
    }

    const messageContent: { type: string; text?: string; image_url?: { url: string } }[] = [
      { type: "text", text: fullPrompt }
    ];
    
    for (const url of imageUrls) {
      messageContent.push({
        type: "image_url",
        image_url: { url }
      });
    }

    try {
      // Generate all images in parallel
      const generationPromises = Array(quantity).fill(null).map((_, i) => 
        generateSingleImage(LOVABLE_API_KEY, messageContent, supabaseAdmin, claimedJob.user_id, i)
      );

      const results = await Promise.all(generationPromises);
      const successfulImages = results.filter((url): url is string => url !== null);
      const failedCount = quantity - successfulImages.length;

      console.log(`Generated ${successfulImages.length}/${quantity} images for job ${claimedJob.id}`);

      // Refund credits for failed generations
      if (failedCount > 0) {
        const refundAmount = failedCount * CREDITS_PER_IMAGE;
        await supabaseAdmin
          .from('profiles')
          .update({ credits: supabaseAdmin.rpc('increment', { x: refundAmount }) })
          .eq('user_id', claimedJob.user_id);
        
        // Direct increment since we don't have an increment RPC
        const { data: currentProfile } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('user_id', claimedJob.user_id)
          .single();
        
        if (currentProfile) {
          await supabaseAdmin
            .from('profiles')
            .update({ credits: currentProfile.credits + refundAmount })
            .eq('user_id', claimedJob.user_id);
        }
        
        console.log(`Refunded ${refundAmount} credits for ${failedCount} failed generation(s)`);
      }

      // If all failed, handle as error
      if (successfulImages.length === 0) {
        throw new Error("All image generations failed");
      }

      // Save successful generations to database with result_node_id
      const generationInserts = successfulImages.map(imageUrl => ({
        user_id: claimedJob.user_id,
        project_id: claimedJob.project_id,
        prompt: prompt,
        aspect_ratio: aspectRatio || '1:1',
        image_url: imageUrl,
        status: 'completed',
        saved_to_gallery: true,
        result_node_id: resultId || null
      }));

      await supabaseAdmin.from('generations').insert(generationInserts);

      // Mark job as completed with results
      const { error: completeError } = await supabaseAdmin.rpc('complete_job_with_result', {
        p_job_id: claimedJob.id,
        p_result_urls: successfulImages,
        p_result_count: successfulImages.length
      });

      if (completeError) {
        console.error("Error completing job:", completeError);
      }

      console.log(`Job ${claimedJob.id} completed successfully with ${successfulImages.length} images`);

      return new Response(
        JSON.stringify({ 
          success: true,
          jobId: claimedJob.id,
          imagesGenerated: successfulImages.length,
          imagesFailed: failedCount
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (error) {
      console.error(`Job ${claimedJob.id} failed:`, error);

      const currentRetries = claimedJob.retries || 0;
      const maxRetries = claimedJob.max_retries || MAX_RETRIES;

      if (currentRetries < maxRetries) {
        // Schedule retry with exponential backoff
        const backoffMs = BACKOFF_DELAYS[currentRetries] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
        const nextRunAt = new Date(Date.now() + backoffMs).toISOString();

        await supabaseAdmin
          .from('jobs')
          .update({
            status: 'queued',
            retries: currentRetries + 1,
            next_run_at: nextRunAt,
            error: error instanceof Error ? error.message : "Unknown error"
          })
          .eq('id', claimedJob.id);

        console.log(`Job ${claimedJob.id} scheduled for retry ${currentRetries + 1}/${maxRetries} at ${nextRunAt}`);

        return new Response(
          JSON.stringify({ 
            success: false,
            jobId: claimedJob.id,
            retryScheduled: true,
            nextRetry: currentRetries + 1,
            nextRunAt
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Max retries exceeded - mark as failed and refund all credits
        await supabaseAdmin
          .from('jobs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Max retries exceeded"
          })
          .eq('id', claimedJob.id);

        // Refund all credits
        const refundAmount = quantity * CREDITS_PER_IMAGE;
        const { data: currentProfile } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('user_id', claimedJob.user_id)
          .single();
        
        if (currentProfile) {
          await supabaseAdmin
            .from('profiles')
            .update({ credits: currentProfile.credits + refundAmount })
            .eq('user_id', claimedJob.user_id);
          console.log(`Refunded ${refundAmount} credits for failed job ${claimedJob.id}`);
        }

        console.log(`Job ${claimedJob.id} failed permanently after ${maxRetries} retries`);

        return new Response(
          JSON.stringify({ 
            success: false,
            jobId: claimedJob.id,
            failed: true,
            creditsRefunded: refundAmount
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

  } catch (error) {
    console.error("Worker error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
