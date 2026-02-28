import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function creditsForResolution(resolution: string): number {
  switch (resolution) {
    case '4K': return 4;
    case '2K': return 2;
    default: return 1;
  }
}
const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [5000, 10000, 20000];

const IMAGE_MODEL_FLASH = "gemini-3.1-flash-image-preview";
const IMAGE_MODEL_PRO = "gemini-3-pro-image-preview";
const FRIENDLY_ERROR_MSG = "Estamos enfrentando uma instabilidade temporária nos servidores da API do Google. Aguarde um instante e tente novamente mais tarde.";

// Select model based on resolution: Pro for 2K/4K, Flash for 1K
function getModelForResolution(resolution: string): string {
  return (resolution === '2K' || resolution === '4K') ? IMAGE_MODEL_PRO : IMAGE_MODEL_FLASH;
}

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

// Max size for reference images (20MB)
const MAX_REF_IMAGE_BYTES = 20 * 1024 * 1024;

// Upload a file to Gemini Files API (streaming, no base64 in memory)
async function uploadToGeminiFiles(
  apiKey: string,
  imageUrl: string
): Promise<{ fileUri: string; mimeType: string } | null> {
  try {
    // Fetch the image as a stream/buffer
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
      console.error(`Failed to fetch image ${imageUrl}: ${resp.status}`);
      return null;
    }

    const contentType = resp.headers.get("content-type") || "image/png";
    const mimeType = contentType.split(";")[0].trim();
    const buffer = await resp.arrayBuffer();
    const sizeBytes = buffer.byteLength;

    console.log(`Reference image size: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB`);

    if (sizeBytes > MAX_REF_IMAGE_BYTES) {
      console.warn(`Skipping reference image (${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds limit): ${imageUrl}`);
      return null;
    }

    // Upload to Gemini Files API using resumable upload
    const startUploadResp = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(sizeBytes),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: { displayName: `ref-${Date.now()}` },
        }),
      }
    );

    if (!startUploadResp.ok) {
      const errText = await startUploadResp.text();
      console.error("Gemini Files API start upload failed:", startUploadResp.status, errText);
      return null;
    }

    const uploadUrl = startUploadResp.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
      console.error("No upload URL returned from Gemini Files API");
      return null;
    }

    // Upload the actual bytes
    const uploadResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(sizeBytes),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: buffer,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      console.error("Gemini Files API upload failed:", uploadResp.status, errText);
      return null;
    }

    const uploadResult = await uploadResp.json();
    const fileUri = uploadResult.file?.uri;

    if (!fileUri) {
      console.error("No file URI in Gemini Files API response:", uploadResult);
      return null;
    }

    console.log(`Uploaded reference to Gemini Files API: ${fileUri} (${(sizeBytes / 1024 / 1024).toFixed(2)}MB)`);
    return { fileUri, mimeType };
  } catch (error) {
    console.error(`Error uploading to Gemini Files API:`, error);
    return null;
  }
}

// Delete a file from Gemini Files API (best effort)
async function deleteGeminiFile(apiKey: string, fileUri: string): Promise<void> {
  try {
    // fileUri format: https://generativelanguage.googleapis.com/v1beta/files/FILE_NAME
    // We need the file name part for the delete endpoint
    const fileName = fileUri.split("/").pop();
    if (!fileName) return;

    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`,
      { method: "DELETE" }
    );
  } catch {
    // Best effort cleanup
  }
}

// Reference metadata from enriched payload
interface ReferenceInfo {
  url: string;
  index: number;
  label?: string;
}

// Generate a single image via Google AI Studio native API
async function generateSingleImage(
  apiKey: string,
  prompt: string,
  references: ReferenceInfo[],
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  userId: string,
  index: number,
  aspectRatio: string = '',
  resolution: string = '1K'
): Promise<string | null> {
  console.log(`[generateSingleImage] Starting image ${index} with model: ${getModelForResolution(resolution)}, prompt length: ${prompt.length}, references: ${references.length}, resolution: ${resolution}`);

  if (references.length === 0) {
    const parts: Record<string, unknown>[] = [{ text: prompt }];
    return await callGeminiAndUpload(apiKey, parts, supabaseAdmin, userId, index, aspectRatio, resolution, []);
  }

  const parts: Record<string, unknown>[] = [];
  const uploadedFileUris: string[] = [];

  parts.push({ text: prompt });

  // Upload reference images via Gemini Files API, with label context
  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const url = ref.url;
    const label = ref.label || `Imagem ${i + 1}`;

    // Insert text label before the image so Gemini knows which image is which
    parts.push({ text: `[Imagem: ${label}]` });

    if (url.startsWith("data:")) {
      const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        parts.push({ inline_data: { mime_type: matches[1], data: matches[2] } });
      }
    } else {
      const fileInfo = await uploadToGeminiFiles(apiKey, url);
      if (fileInfo) {
        parts.push({ file_data: { file_uri: fileInfo.fileUri, mime_type: fileInfo.mimeType } });
        uploadedFileUris.push(fileInfo.fileUri);
      } else {
        console.warn(`Failed to upload reference image ${i + 1} (${label}) to Gemini Files API, skipping`);
      }
    }
  }

  return await callGeminiAndUpload(apiKey, parts, supabaseAdmin, userId, index, aspectRatio, resolution, uploadedFileUris);
}

// Call Gemini API and upload result to storage
async function callGeminiAndUpload(
  apiKey: string,
  parts: Record<string, unknown>[],
  supabaseAdmin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  userId: string,
  index: number,
  aspectRatio: string = '',
  resolution: string = '1K',
  uploadedFileUris: string[] = []
): Promise<string | null> {
  const model = getModelForResolution(resolution);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const imageConfig: Record<string, unknown> = {};
  if (aspectRatio) {
    imageConfig.aspectRatio = aspectRatio;
  }

  // Add imageSize for 2K/4K (only supported by Pro model)
  if (resolution === '2K' || resolution === '4K') {
    imageConfig.imageSize = resolution;
    console.log(`[callGeminiAndUpload] Using model ${model} with imageSize: ${resolution}`);
  }

  console.log(`[callGeminiAndUpload] Calling Google API for image ${index}, model: ${model}, parts count: ${parts.length}, aspectRatio: ${aspectRatio || 'auto (omitted)'}, resolution: ${resolution}`);
  const fetchStart = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig
        }
      }),
    });

    console.log(`[generateSingleImage] Google API responded in ${Date.now() - fetchStart}ms, status: ${response.status}`);

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

    const imagePart = responseParts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
      console.error("No image data in response parts");
      return null;
    }

    const { mimeType, data: imageBase64 } = imagePart.inlineData;
    const base64DataUrl = `data:${mimeType};base64,${imageBase64}`;

    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;
    const publicUrl = await uploadBase64ToStorage(supabaseAdmin, base64DataUrl, userId, fileName);
    
    if (!publicUrl) {
      console.error("Failed to upload image to storage");
      return null;
    }

    return publicUrl;
  } finally {
    // Clean up uploaded files from Gemini (best effort, non-blocking)
    for (const uri of uploadedFileUris) {
      deleteGeminiFile(apiKey, uri);
    }
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

    // Auto-recover stuck jobs (processing > 3 minutes)
    // Now properly increments retries and fails jobs that exceed max_retries
    const { data: stuckJobs, error: stuckError } = await supabaseAdmin
      .from('jobs')
      .select('id, retries, max_retries')
      .eq('status', 'processing')
      .lt('started_at', new Date(Date.now() - 3 * 60 * 1000).toISOString());

    if (stuckError) {
      console.error("Error finding stuck jobs:", stuckError);
    } else if (stuckJobs && stuckJobs.length > 0) {
      console.log(`Found ${stuckJobs.length} stuck job(s), recovering with retry tracking`);
      
      for (const stuck of stuckJobs) {
        const currentRetries = (stuck.retries || 0) + 1;
        const maxRetries = stuck.max_retries || MAX_RETRIES;

        if (currentRetries >= maxRetries) {
          // Exceeded max retries — fail permanently
          await supabaseAdmin
            .from('jobs')
            .update({
              status: 'failed',
              finished_at: new Date().toISOString(),
              error: 'Job failed after max retries (likely memory limit exceeded with large reference images)',
              retries: currentRetries,
            })
            .eq('id', stuck.id);
          console.log(`Stuck job ${stuck.id} failed permanently (retries: ${currentRetries}/${maxRetries})`);
        } else {
          // Re-queue with backoff
          const backoffMs = BACKOFF_DELAYS[currentRetries - 1] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
          const nextRunAt = new Date(Date.now() + backoffMs).toISOString();
          
          await supabaseAdmin
            .from('jobs')
            .update({
              status: 'queued',
              retries: currentRetries,
              next_run_at: nextRunAt,
              error: `Auto-recovered from stuck processing (attempt ${currentRetries}/${maxRetries})`,
            })
            .eq('id', stuck.id);
          console.log(`Stuck job ${stuck.id} re-queued (retry ${currentRetries}/${maxRetries}, next_run_at: ${nextRunAt})`);
        }
      }
    }

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
      references?: ReferenceInfo[];
      resultId?: string;
      resolution?: string;
    };

    const { prompt, aspectRatio, quantity, references = [], resultId, resolution = '1K' } = payload;

    const fullPrompt = prompt;

    const validReferences = references.filter(ref => {
      const isSvg = ref.url.toLowerCase().endsWith('.svg') || ref.url.includes('.svg?');
      if (isSvg) console.warn(`Skipping SVG reference: ${ref.url}`);
      return !isSvg;
    }).slice(0, 10);
    
    console.log(`Using ${validReferences.length} references`);

    try {
      // Generate images SEQUENTIALLY to avoid memory limit exceeded
      const results: (string | null)[] = [];
      for (let i = 0; i < quantity; i++) {
        const result = await generateSingleImage(GOOGLE_AI_API_KEY, fullPrompt, validReferences, supabaseAdmin, claimedJob.user_id, i, aspectRatio, resolution);
        results.push(result);
      }
      const successfulImages = results.filter((url): url is string => url !== null);

      console.log(`Generated ${successfulImages.length}/${quantity} images for job ${claimedJob.id}`);

      if (successfulImages.length === 0) {
        throw new Error("All image generations failed");
      }

      const savedImages: string[] = [];
      for (const imageUrl of successfulImages) {
        try {
          await supabaseAdmin.rpc('decrement_credits', { uid: claimedJob.user_id, amount: creditsForResolution(resolution) });
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
          aspect_ratio: aspectRatio || 'auto',
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
