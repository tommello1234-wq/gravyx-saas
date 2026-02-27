

## Plan: Switch image-worker to use Google AI Studio API key directly

The project currently routes image generation through the Lovable AI Gateway (`ai.gateway.lovable.dev`) using `LOVABLE_API_KEY`. The user wants to use their own Google AI Studio API key instead, calling Google's Generative Language API directly.

### Important Security Note
The API key shared in chat will be stored as a Supabase secret (never in code).

### Steps

1. **Add the secret `GOOGLE_AI_API_KEY`** with the value provided by the user, stored securely in Supabase secrets.

2. **Update `supabase/functions/image-worker/index.ts`**:
   - Replace the Lovable Gateway endpoint (`ai.gateway.lovable.dev/v1/chat/completions`) with Google's Generative Language API endpoint (`generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`)
   - Use `GOOGLE_AI_API_KEY` instead of `LOVABLE_API_KEY`
   - Adapt the request/response format from OpenAI-compatible to Google's native format (parts array, inline_data for images, responseModalities)
   - Keep the same model (`gemini-2.0-flash-exp` or the current `gemini-3-pro-image-preview` — whichever is available on Google AI Studio)
   - Maintain all existing retry, credit deduction, and storage upload logic unchanged

### Technical Detail: API Format Change

**Current (Lovable Gateway - OpenAI format):**
```
POST ai.gateway.lovable.dev/v1/chat/completions
Authorization: Bearer LOVABLE_API_KEY
{ model, messages: [{role, content}], modalities }
```

**New (Google AI Studio - native format):**
```
POST generativelanguage.googleapis.com/v1beta/models/MODEL:generateContent?key=API_KEY
{ contents: [{parts: [{text}, {inline_data: {mime_type, data}}]}], generationConfig: {responseModalities: ["TEXT","IMAGE"]} }
```

Response parsing will change from `choices[0].message.images[0].image_url.url` to `candidates[0].content.parts[].inlineData`.

