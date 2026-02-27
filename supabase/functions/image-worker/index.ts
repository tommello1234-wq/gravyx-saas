import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDITS_PER_IMAGE = 1;
const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [5000, 10000, 20000];

const IMAGE_MODEL = "gemini-2.5-flash-preview-image-generation";
const FRIENDLY_ERROR_MSG = "Estamos enfrentando uma instabilidade temporária nos servidores da API do Google. Aguarde um instante e tente novamente mais tarde.";

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

// Fetch an image URL and return base64-encoded data + mime type
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Failed to fetch image ${url}: ${resp.status}`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const base64 = base64Encode(bytes);
    const contentType = resp.headers.get("content-type") || "image/png";
    const mimeType = contentType.split(";")[0].trim();
    return { base64, mimeType };
  } catch (error) {
    console.error(`Error fetching image ${url}:`, error);
    return null;
  }
}

// Generate a single image via Google AI Studio native API
async function generateSingleImage(
  apiKey: string,
  prompt: string,
  imageUrls: string[],
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  userId: string,
  index: number
): Promise<string | null> {
  console.log(`Generating image ${index} with model: ${IMAGE_MODEL}`);

  // Build parts array for Google API
  const parts: Record<string, unknown>[] = [{ text: prompt }];

  // Add reference images as inline_data
  for (const url of imageUrls) {
    if (url.startsWith("data:")) {
      // Already base64 data URL
      const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inline_data: { mime_type: matches[1], data: matches[2] }
        });
      }
    } else {
      // Fetch remote image and convert to base64
      const imgData = await fetchImageAsBase64(url);
      if (imgData) {
        parts.push({
          inline_data: { mime_type: imgData.mimeType, data: imgData.base64 }
        });
      }
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Google AI API error:`, response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    
    if (response.status >= 500) {
      throw new Error(FRIENDLY_ERROR_MSG);
    }
    
    return null;
  }

  const data = await response.json();

  // Extract image from Google's response format
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    console.error("No candidates in Google AI response");
    return null;
  }

  const responseParts = candidates[0]?.content?.parts;
  if (!responseParts) {
    console.error("No parts in candidate response");
    return null;
  }

  // Find the first image part
  const imagePart = responseParts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);
  if (!imagePart || !imagePart.inlineData) {
    console.error("No image data in response parts");
    return null;
  }

  const { mimeType, data: imageBase64 } = imagePart.inlineData;
  const extension = mimeType.split("/")[1] || "png";
  const base64DataUrl = `data:${mimeType};base64,${imageBase64}`;

  const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;
  const publicUrl = await uploadBase64ToStorage(supabaseAdmin, base64DataUrl, userId, fileName);
  
  if (!publicUrl) {
    console.error("Failed to upload image to storage");
    return null;
  }

  return publicUrl;
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

  if (WORKER_SECRET && token === WORKER_SECRET) {
    isAuthenticated = true;
  }

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

  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GOOGLE_AI_API_KEY) {
    console.error("GOOGLE_AI_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: job, error: claimError } = await supabaseAdmin.rpc('claim_next_job', {
      p_worker_id: crypto.randomUUID()
    });
    
    if (claimError) {
      console.error("Error claiming job:", claimError);
      return new Response(
        JSON.stringify({ error: "Failed to claim job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!job || (Array.isArray(job) && job.length === 0)) {
      return new Response(
        JSON.stringify({ message: "No jobs available" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claimedJob = Array.isArray(job) ? job[0] : job;
    console.log(`Processing job ${claimedJob.id} for user ${claimedJob.user_id}`);

    const payload = claimedJob.payload as {
      prompt: string;
      aspectRatio: string;
      quantity: number;
      imageUrls: string[];
      resultId?: string;
    };

    const { prompt, aspectRatio, quantity, imageUrls = [], resultId } = payload;

    let fullPrompt = prompt;
    if (aspectRatio) {
      fullPrompt = `${prompt}. Aspect ratio: ${aspectRatio}`;
    }

    // Filter out SVG URLs
    const validImageUrls = imageUrls.filter(url => {
      const isSvg = url.toLowerCase().endsWith('.svg') || url.includes('.svg?');
      if (isSvg) {
        console.warn(`Skipping SVG image URL: ${url}`);
      }
      return !isSvg;
    });

    try {
      const generationPromises = Array(quantity).fill(null).map((_, i) => 
        generateSingleImage(GOOGLE_AI_API_KEY, fullPrompt, validImageUrls, supabaseAdmin, claimedJob.user_id, i)
      );

      const results = await Promise.all(generationPromises);
      const successfulImages = results.filter((url): url is string => url !== null);

      console.log(`Generated ${successfulImages.length}/${quantity} images for job ${claimedJob.id}`);

      if (successfulImages.length === 0) {
        throw new Error("All image generations failed");
      }

      const savedImages: string[] = [];
      for (const imageUrl of successfulImages) {
        try {
          await supabaseAdmin.rpc('decrement_credits', { uid: claimedJob.user_id, amount: CREDITS_PER_IMAGE });
          savedImages.push(imageUrl);
        } catch (debitError) {
          console.error(`Failed to debit credit for image, skipping save:`, debitError);
        }
      }

      if (savedImages.length > 0) {
        const generationInserts = savedImages.map(imageUrl => ({
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

        for (let i = 0; i < savedImages.length; i++) {
          try {
            await supabaseAdmin.rpc('increment_total_generations', { uid: claimedJob.user_id });
          } catch (e) {
            console.error('Failed to increment total_generations:', e);
          }
        }
      }

      const { error: completeError } = await supabaseAdmin.rpc('complete_job_with_result', {
        p_job_id: claimedJob.id,
        p_result_urls: savedImages,
        p_result_count: savedImages.length
      });

      if (completeError) {
        console.error("Error completing job:", completeError);
      }

      console.log(`Job ${claimedJob.id} completed: ${savedImages.length} images saved`);

      return new Response(
        JSON.stringify({ 
          success: true,
          jobId: claimedJob.id,
          imagesGenerated: savedImages.length,
          imagesFailed: quantity - savedImages.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (error) {
      console.error(`Job ${claimedJob.id} failed:`, error);

      const currentRetries = claimedJob.retries || 0;
      const maxRetries = claimedJob.max_retries || MAX_RETRIES;

      if (currentRetries < maxRetries) {
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
        await supabaseAdmin
          .from('jobs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Max retries exceeded"
          })
          .eq('id', claimedJob.id);

        console.log(`Job ${claimedJob.id} failed permanently after ${maxRetries} retries`);

        return new Response(
          JSON.stringify({ 
            success: false,
            jobId: claimedJob.id,
            failed: true
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

  } catch (error) {
    console.error("Worker error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
