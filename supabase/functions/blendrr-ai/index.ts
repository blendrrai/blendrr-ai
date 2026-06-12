// Supabase Edge Function: blendrr-ai
// AI calls fan out to:
//   - OpenAI gpt-image-1 → makeup try-on (image edits)
//   - fal.ai nano-banana-2/edit → clothing try-on (image edits)
//   - Gemini 2.5 Flash → text/vision tasks (quizzes, ingredient scans,
//     fragrance discovery, skincare/haircare/acne analysis)
// Clients never see any of the keys.
// Deploy: `supabase functions deploy blendrr-ai`

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const FAL_API_KEY = Deno.env.get('FAL_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TEXT_MODEL = 'gemini-2.5-flash';
// Try-on image edits go through OpenAI's gpt-image-1. We previously had a
// chain (gpt-image-2 primary → gpt-image-1 → Gemini Nano Banana 2.5) but
// dropped it on 2026-05-22 — gpt-image-2 isn't broadly available on most
// accounts and the Gemini fallback drifted from our prompt format. One
// model, predictable behaviour, easier to debug.
const OPENAI_IMAGE_MODEL = 'gpt-image-1';
// Clothing try-ons go through fal.ai's hosted nano-banana-2/edit. Same
// underlying Nano Banana model lineage as direct Gemini, but fal.ai runs
// noticeably more inference steps + post-processing per call (~15-25s vs
// ~3-5s direct) which produces visibly sharper, more faithful output —
// confirmed against TradeShot which uses the same endpoint. Beauty stays on
// OpenAI gpt-image-1 — produces better makeup finishes than Gemini.
const FAL_NANO_BANANA_URL = 'https://fal.run/fal-ai/nano-banana-2/edit';

// ============================================================================
// IMAGE GENERATION CONFIG (2026-05-22)
// To revert, restore the PREVIOUS values noted on each line.
// ============================================================================

// History: dynamic ('medium'/'high') → 'low' (2026-05-22) → 'medium'
// (2026-05-23) → 'high' (2026-05-23, current). User decision to always
// ship Ultra HD — no quality choice in the UI anymore. ~£0.13/try-on,
// ~50s generation, sharpest result. The client also no longer offers a
// quality picker; everything goes through this path.
const IMAGE_QUALITY: 'low' | 'medium' | 'high' = 'high';

// DISABLED 2026-05-22: OpenAI's /v1/images/edits silently ignored stream=true
// (returned application/json instead of text/event-stream), so no partial
// frames ever fired. Code paths are kept intact for future use — when we
// switch to the Responses API path or move to a model that streams reliably
// on edits, flip these back to `true` / `2`.
const ENABLE_STREAMING = false;
const PARTIAL_IMAGES_COUNT = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Gemini helpers
// ============================================================================

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

async function callGemini(model: string, body: unknown): Promise<GeminiPart[]> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };

  let res = await fetch(url, init);

  // Retry once on 5xx (Google doesn't bill these)
  if (res.status >= 500 && res.status < 600) {
    await new Promise((r) => setTimeout(r, 800));
    res = await fetch(url, init);
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message ?? text;
    } catch { /* ignore */ }
    throw Object.assign(new Error(message), { status: res.status });
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('No response from Gemini');
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Blocked by safety filter. Try a different photo.');
  }
  return candidate.content?.parts ?? [];
}

function extractText(parts: GeminiPart[]): string {
  return parts.map((p) => p.text).filter(Boolean).join('\n').trim();
}

function extractJson<T>(text: string): T {
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first > 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const repaired = cleaned.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(repaired) as T;
  }
}

// ============================================================================
// OpenAI helpers — for image-edit (try-on) only
// ============================================================================

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Call OpenAI's Images Edit API with one or more reference images.
 * Returns base64-encoded PNG of the edited image.
 *
 * Multi-image: the first image is the canvas being edited; subsequent images
 * are references the model can see (e.g. a product image as a colour reference).
 *
 * Streaming: when `stream` is true and `partialImages > 0`, the API emits SSE
 * events with intermediate preview frames. `onPartial` is called for each one.
 */
async function callOpenAIImageEdit(opts: {
  model: string;
  prompt: string;
  images: { data: string; mime?: string }[];
  quality?: 'low' | 'medium' | 'high' | 'auto';
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  stream?: boolean;
  partialImages?: number;
  onPartial?: (b64: string) => void | Promise<void>;
}): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const wantsStreaming = !!opts.stream && (opts.partialImages ?? 0) > 0;

  const formData = new FormData();
  formData.append('model', opts.model);
  formData.append('prompt', opts.prompt);
  formData.append('n', '1');
  formData.append('size', opts.size ?? 'auto');
  formData.append('quality', opts.quality ?? 'high');
  if (wantsStreaming) {
    formData.append('stream', 'true');
    formData.append('partial_images', String(opts.partialImages));
  }

  opts.images.forEach((img, i) => {
    const bytes = base64ToBytes(img.data);
    const blob = new Blob([bytes], { type: img.mime ?? 'image/jpeg' });
    const ext = (img.mime ?? 'image/jpeg').split('/')[1] ?? 'jpg';
    formData.append('image[]', blob, `image-${i}.${ext}`);
  });

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message ?? text;
    } catch { /* ignore */ }
    throw Object.assign(new Error(`OpenAI ${res.status}: ${message}`), { status: res.status });
  }

  // Detect whether OpenAI honoured our `stream: true` request. If we asked
  // for streaming but the response is plain JSON, OpenAI silently fell back
  // to non-streaming — we then just parse as JSON and return the final
  // (no partials, but the request still succeeds).
  const contentType = res.headers.get('content-type') ?? '';
  const isSse = contentType.includes('text/event-stream');
  console.log(`[openai-edit] model=${opts.model} stream-requested=${wantsStreaming} content-type=${contentType} → ${isSse ? 'SSE' : 'JSON'}`);

  // Non-streaming path — either we didn't ask for it, or OpenAI didn't honour it.
  if (!wantsStreaming || !isSse) {
    if (wantsStreaming && !isSse) {
      console.log(`[openai-edit] WARNING: stream=true was requested but OpenAI returned ${contentType}. No partial frames will fire.`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI returned no image data');
    return b64;
  }

  // Streaming path — parse SSE, emit partials, return final.
  if (!res.body) throw new Error('OpenAI streaming response had no body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalB64: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are newline-delimited. Keep the trailing partial line in
    // the buffer until the next chunk completes it.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let event: { type?: string; b64_json?: string; data?: { b64_json?: string }[] };
      try {
        event = JSON.parse(payload);
      } catch {
        console.log(`[openai-edit] SSE: non-JSON data line, skipping: ${payload.slice(0, 80)}`);
        continue;
      }
      const eventType = event.type ?? '(no type)';
      const b64 = event.b64_json ?? event.data?.[0]?.b64_json;
      console.log(`[openai-edit] SSE event: type=${eventType} hasB64=${!!b64} b64Len=${b64?.length ?? 0}`);
      if (!b64) continue;
      if (eventType.includes('partial_image')) {
        try {
          await opts.onPartial?.(b64);
        } catch (cbErr) {
          // Don't let a logging/db failure abort the generation
          console.log(`[openai-edit] onPartial threw: ${cbErr instanceof Error ? cbErr.message : cbErr}`);
        }
      } else if (eventType.includes('completed') || eventType.includes('image.generated')) {
        finalB64 = b64;
      } else {
        // Unknown event type that still carries a b64 — keep latest as a
        // safety net so we don't lose the final image on event-name drift.
        finalB64 = b64;
      }
    }
  }

  if (!finalB64) throw new Error('OpenAI streaming returned no final image');
  return finalB64;
}

/**
 * Call fal.ai's nano-banana-2/edit endpoint. Returns base64-encoded JPEG.
 *
 * Same convention as the OpenAI helper: the first image is the canvas, the
 * second onwards are references. fal.ai accepts data: URIs in image_urls
 * so we don't need a transient hosting step. The response contains a CDN
 * URL — we fetch + base64-encode so the caller's contract (returns base64)
 * matches the OpenAI path and we can drop the result into the same DB
 * column without branching downstream.
 *
 * Used only for the clothing try-on path. Beauty try-ons stay on OpenAI
 * gpt-image-1 (which is direct, no fal.ai involvement).
 */
async function callFalNanoBanana(opts: {
  prompt: string;
  images: { data: string; mime?: string }[];
}): Promise<string> {
  if (!FAL_API_KEY) throw new Error('FAL_API_KEY not configured');

  const imageUrls = opts.images.map((img) => {
    const mime = img.mime ?? 'image/jpeg';
    return `data:${mime};base64,${img.data}`;
  });

  const res = await fetch(FAL_NANO_BANANA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      image_urls: imageUrls,
      num_images: 1,
      output_format: 'jpeg',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`fal.ai ${res.status}: ${errorText.slice(0, 240)}`);
  }

  const data = await res.json();
  const generatedImageUrl: string | undefined = data?.images?.[0]?.url;
  if (!generatedImageUrl) {
    throw new Error(`fal.ai returned no image. Response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const imageRes = await fetch(generatedImageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch generated image: HTTP ${imageRes.status}`);
  }
  const bytes = new Uint8Array(await imageRes.arrayBuffer());
  // Chunked binary → string to dodge Deno's apply() stack limit on big images.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

// ============================================================================
// Task handlers
// ============================================================================

type Zone =
  | 'lips'
  | 'foundation'
  | 'concealer'
  | 'blush'
  | 'bronzer'
  | 'eyeliner'
  | 'eyeshadow'
  | 'mascara'
  | 'eyebrows'
  | 'hair';

// Two-sentence prompts: a conversational request + an explicit face-
// preservation clause. ChatGPT-direct experiments showed that a short
// natural prompt outperforms our previous 80-line preservation walls.
// The second sentence adds the one constraint gpt-image-1 sometimes drifts
// on (face features / shape / skin tone), without overwhelming the model
// with a long negation list.
//
// For zones that genuinely change the skin's appearance (foundation,
// concealer), we drop "skin tone" from the preservation clause and keep
// only features + shape — otherwise the model gets contradictory signals
// ("apply foundation but don't change skin").
function buildTryOnPrompt(zone: Zone): string {
  switch (zone) {
    case 'lips':       return 'Add this lipstick on me. Keep my face, skin tone, and features exactly the same.';
    case 'foundation': return 'Apply this foundation on me. Keep my facial features and face shape exactly the same.';
    case 'concealer':  return 'Apply this concealer on me. Keep my facial features and face shape exactly the same.';
    case 'blush':      return 'Apply this blush on me. Keep my face, skin tone, and features exactly the same.';
    case 'bronzer':    return 'Apply this bronzer on me. Keep my face, skin tone, and features exactly the same.';
    case 'eyeshadow':  return 'Apply this eyeshadow on me. Keep my face, skin tone, and features exactly the same.';
    case 'eyeliner':   return 'Apply this eyeliner on me. Keep my face, skin tone, and features exactly the same.';
    case 'mascara':    return 'Apply this mascara on me. Keep my face, skin tone, and features exactly the same.';
    case 'eyebrows':   return 'Apply this eyebrow product on me. Keep my face, skin tone, and features exactly the same.';
    case 'hair':       return 'Apply this hair colour on me. Keep my face, skin tone, and features exactly the same.';
  }
}

// Multi-product full-face try-on. The selfie is image 1; the next N images
// are makeup products. GPT identifies what each one is and applies them to
// the appropriate region of the face.
function buildMultiTryOnPrompt(): string {
  return 'Apply all of these makeup products on me. Keep my facial features and face shape exactly the same.';
}

type ClothingZone = 'top' | 'bottom' | 'dress' | 'shoes' | 'jewelry' | 'accessory';

/**
 * Per-zone clothing try-on prompts — tuned for Gemini 2.5 Flash Image.
 *
 * Gemini Image responds best to:
 *   - Natural conversational tone (not rigid bullet lists)
 *   - "Image 1 / Image 2" reference labels (its native convention)
 *   - "Take X from Image 1 and..." scene-setting openers
 *   - ONE preservation sentence, not exhaustive negation lists
 *   - Anatomy named specifically where it matters
 *   - "Real photo" framing in the close — pushes away from AI sheen
 */
function buildClothingTryOnPrompt(zone: ClothingZone): string {
  switch (zone) {
    case 'top':
      return `Take the person from Image 1 and dress them in the top shown in Image 2.

Match the new top exactly to Image 2 — same colour, pattern, fabric, cut, length, neckline, and sleeve style. Do not change the design, style, or fit of the garment in any way.

THE FACE MUST STAY PIXEL-IDENTICAL to Image 1 — the same eyes, eyebrows, eyelashes, nose, lips, mouth, jawline, chin, ears, hairline, freckles, makeup, expression, and skin texture. Do NOT retouch, smooth, slim, beautify, age, de-age, or modify ANY facial feature in any way. The person in the output must be unmistakably the same person as in Image 1 — any face change is a failed result.

Keep the rest of the person identical to Image 1 — same face, body shape, build, skin tone, hair, pose, and proportions. Do not slim, reshape, tone, smooth, or modify the body in any way.

Keep the room, background, and camera identical to Image 1 — same walls, furniture, floor, lighting, shadows, aspect ratio, camera angle, and camera position. Do not change the setting, do not zoom in or out, and do not re-frame or re-crop the shot.

If the new top reveals arms or skin that were previously covered, those arms and skin look the same as in Image 1 — same shape, same skin tone — not redrawn.

The result should look like a real photo of the same person, in the same place, now wearing the top from Image 2.`;

    case 'bottom':
      return `Take the person from Image 1 and put them in the bottoms shown in Image 2 (trousers, jeans, shorts, or skirt).

Match the new bottoms exactly to Image 2 — same colour, pattern, fabric, cut, length, waistband, and silhouette. Do not change the design, style, or fit of the garment in any way.

THE FACE MUST STAY PIXEL-IDENTICAL to Image 1 — the same eyes, eyebrows, eyelashes, nose, lips, mouth, jawline, chin, ears, hairline, freckles, makeup, expression, and skin texture. Do NOT retouch, smooth, slim, beautify, age, de-age, or modify ANY facial feature in any way. The person in the output must be unmistakably the same person as in Image 1 — any face change is a failed result.

Keep the rest of the person identical to Image 1 — same face, body shape, build, skin tone, hair, legs, pose, and proportions. Do not slim, tone, reshape, smooth, or modify the body in any way.

Keep the room, background, and camera identical to Image 1 — same walls, furniture, floor, lighting, shadows, aspect ratio, camera angle, and camera position. Do not change the setting, do not zoom in or out, and do not re-frame or re-crop the shot.

If the new bottoms are shorter than the originals, the newly visible legs stay identical to Image 1 — same shape, same skin tone — not redrawn or slimmed.

The result should look like a real photo of the same person, in the same place, now wearing the bottoms from Image 2.`;

    case 'dress':
      return `Take the person from Image 1 and dress them in the outfit shown in Image 2 (dress, jumpsuit, romper, or co-ord).

Match the new garment exactly to Image 2 — same colour, pattern, fabric, cut, length, neckline, hemline, sleeve length, and silhouette. Do not change the design, style, or fit of the garment in any way.

THE FACE MUST STAY PIXEL-IDENTICAL to Image 1 — the same eyes, eyebrows, eyelashes, nose, lips, mouth, jawline, chin, ears, hairline, freckles, makeup, expression, and skin texture. Do NOT retouch, smooth, slim, beautify, age, de-age, or modify ANY facial feature in any way. The person in the output must be unmistakably the same person as in Image 1 — any face change is a failed result.

Keep the rest of the person identical to Image 1 — same face, body shape, build, skin tone, hair, pose, and proportions. The garment must adapt to the person's real body — do not slim, tone, lengthen, reshape, or model-ify the body to fit the outfit.

Keep the room, background, and camera identical to Image 1 — same walls, furniture, floor, lighting, shadows, aspect ratio, camera angle, and camera position. Do not change the setting, do not zoom in or out, and do not re-frame or re-crop the shot.

Body parts not covered by the new garment (e.g. legs below a dress hem, arms below short sleeves) look identical to Image 1.

The result should look like a real photo of the same person, in the same place, now wearing the outfit from Image 2.`;

    case 'shoes':
      return `Take the person from Image 1 and put them in the shoes shown in Image 2.

Match the new shoes exactly to Image 2 — same colour, material, shape, style, height, and design details. Do not change the design, style, or fit of the shoes in any way.

THE FACE MUST STAY PIXEL-IDENTICAL to Image 1 — the same eyes, eyebrows, eyelashes, nose, lips, mouth, jawline, chin, ears, hairline, freckles, makeup, expression, and skin texture. Do NOT retouch, smooth, slim, beautify, age, de-age, or modify ANY facial feature in any way. The person in the output must be unmistakably the same person as in Image 1 — any face change is a failed result.

Keep the rest of the person identical to Image 1 — same face, body, legs, feet, ankles, skin tone, hair, clothing, posture, and stance. Do not change the body or any clothing other than the shoes. If the new shoes are a different height to the originals (e.g. heels replacing flats), do not adjust the person's height, leg length, posture, or stance to compensate.

Keep the room, background, and camera identical to Image 1 — same floor, walls, furniture, lighting, shadows, aspect ratio, camera angle, and camera position. Do not change the setting, do not zoom in or out, and do not re-frame or re-crop the shot.

The result should look like a real photo of the same person, in the same place, now wearing the shoes from Image 2.`;

    case 'jewelry':
      return `Take the person from Image 1 and add the jewelry shown in Image 2 to the appropriate body part (necklace on the chest or collarbones, earrings on the ears, bracelet on a wrist, ring on a finger, anklet on an ankle).

Match the jewelry exactly to Image 2 — same metal, stones, beads, shape, length, and design details. Do not change the design or style of the piece in any way.

THE FACE MUST STAY PIXEL-IDENTICAL to Image 1 — the same eyes, eyebrows, eyelashes, nose, lips, mouth, jawline, chin, ears, hairline, freckles, makeup, expression, and skin texture. Do NOT retouch, smooth, slim, beautify, age, de-age, or modify ANY facial feature in any way. The person in the output must be unmistakably the same person as in Image 1 — any face change is a failed result.

Keep the rest of the person identical to Image 1 — same face, body shape, skin tone, hair, clothing, hands, and proportions. Do not change the body, the clothing, or anything else about the person.

Keep the room, background, and camera identical to Image 1 — same walls, furniture, floor, lighting, shadows, aspect ratio, camera angle, and camera position. Do not change the setting, do not zoom in or out, and do not re-frame or re-crop the shot.

Do not remove any existing jewelry unless it directly conflicts with the new piece (e.g. swapping one necklace for another).

The result should look like a real photo of the same person, in the same place, now wearing the jewelry from Image 2.`;

    case 'accessory':
      return `Take the person from Image 1 and add the accessory shown in Image 2 to the appropriate part of the body (bag in a hand or on a shoulder, hat on the head over the existing hair, scarf around the neck, sunglasses over the eyes, belt at the waistband, headband in the hair, gloves on the hands).

Match the accessory exactly to Image 2 — same colour, material, shape, size, and design details. Do not change the design or style of the item in any way.

THE FACE MUST STAY PIXEL-IDENTICAL to Image 1 — the same eyes, eyebrows, eyelashes, nose, lips, mouth, jawline, chin, ears, hairline, freckles, makeup, expression, and skin texture. Do NOT retouch, smooth, slim, beautify, age, de-age, or modify ANY facial feature in any way. The person in the output must be unmistakably the same person as in Image 1 — any face change is a failed result.

Keep the rest of the person identical to Image 1 — same face, body shape, skin tone, hair, clothing, hands, and proportions. Do not change the body, the clothing, or anything else about the person.

Keep the room, background, and camera identical to Image 1 — same walls, furniture, floor, lighting, shadows, aspect ratio, camera angle, and camera position. Do not change the setting, do not zoom in or out, and do not re-frame or re-crop the shot.

If it's sunglasses, the eyes underneath stay identical — the lenses just sit over them. If it's a hat, the existing hair stays the same and tucks under or around the hat naturally.

The result should look like a real photo of the same person, in the same place, now wearing the accessory from Image 2.`;
  }
}

async function handleTryOn(payload: {
  selfieImage: string;
  productImage?: string;
  productImages?: string[];
  zone: Zone;
  mode?: 'single' | 'multi';
  quality?: 'medium' | 'ultra';
  category?: 'beauty' | 'clothing';
  clothingZone?: ClothingZone;
}, onPartial?: (b64: string) => void | Promise<void>) {
  const category: 'beauty' | 'clothing' = payload.category === 'clothing' ? 'clothing' : 'beauty';
  // Clothing flow is always single-product (no multi-mode), so coerce here.
  const mode: 'single' | 'multi' = category === 'clothing'
    ? 'single'
    : (payload.mode === 'multi' ? 'multi' : 'single');
  const quality: 'medium' | 'ultra' = payload.quality === 'ultra' ? 'ultra' : 'medium';
  const openAIQuality = IMAGE_QUALITY;

  // Collect product images. Single mode = 1; multi mode = N (up to 5).
  const productImages: string[] = mode === 'single'
    ? (payload.productImage ? [payload.productImage] : [])
    : (payload.productImages ?? []);

  if (productImages.length === 0) {
    throw new Error('No product image provided.');
  }
  if (mode === 'multi' && productImages.length > 5) {
    throw new Error('Multi mode supports up to 5 products.');
  }

  // Beauty try-ons used to run a Gemini "describe shade" pre-step that
  // extracted a hex code from the product image and stuffed it into the
  // GPT prompt. Removed 2026-05-25: testing showed that ChatGPT directly,
  // given just the selfie + product image + "Add this lipstick on me",
  // produced visibly better results than our verbose hex-anchored pipeline.
  // GPT reads the product colour directly from the reference image — the
  // hex was at best redundant and at worst conflicting with what the model
  // actually saw. shade is no longer extracted; the field stays in the
  // return value as `null` for back-compat with the tryon_jobs.shade column.
  const shade = null;

  // Step 2: generate try-on image.
  //   Beauty   → OpenAI gpt-image-1 ONLY (best makeup finishes; prompt is a
  //              one-line conversational request, no hex extraction).
  //   Clothing → fal.ai nano-banana-2/edit ONLY (Nano Banana hosted, sharper
  //              than direct Gemini due to extra inference steps + post-
  //              processing).
  //
  // NO FALLBACK between providers. If the chosen vendor errors, the error
  // bubbles up to the async dispatcher, which refunds the credit and marks
  // the job as failed. The user then sees "That didn't land" with the
  // underlying error message. Mixing providers when one fails would produce
  // visually inconsistent results, so we'd rather surface the failure than
  // silently degrade.
  const images = [
    { data: payload.selfieImage, mime: 'image/jpeg' },
    ...productImages.map((data) => ({ data, mime: 'image/jpeg' })),
  ];

  let imageBase64: string;
  if (category === 'clothing') {
    const cz: ClothingZone = payload.clothingZone ?? 'top';
    const clothingPrompt = buildClothingTryOnPrompt(cz);
    console.log(`[try-on] fal nano-banana-2 (clothing, zone=${cz}, products=${productImages.length})`);
    // No try/catch — if fal.ai fails, throw and let the dispatcher refund
    // the credit. Do NOT fall back to OpenAI for clothing.
    imageBase64 = await callFalNanoBanana({
      prompt: clothingPrompt,
      images,
    });
  } else {
    const openAIPrompt = mode === 'single'
      ? buildTryOnPrompt(payload.zone)
      : buildMultiTryOnPrompt();
    console.log(`[try-on] openai ${OPENAI_IMAGE_MODEL} (${openAIQuality}, mode=${mode}, zone=${payload.zone}, products=${productImages.length}, stream=${ENABLE_STREAMING}, prompt="${openAIPrompt}")`);
    imageBase64 = await callOpenAIImageEdit({
      model: OPENAI_IMAGE_MODEL,
      prompt: openAIPrompt,
      quality: openAIQuality,
      images,
      stream: ENABLE_STREAMING,
      partialImages: PARTIAL_IMAGES_COUNT,
      onPartial,
    });
  }

  return {
    imageBase64,
    shade,
    mode,
    quality,
  };
}

function formatAnswers(answers: Record<string, unknown>, labels: Record<string, string>): string {
  return Object.entries(answers)
    .map(([k, v]) => `- ${labels[k] ?? k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
}

const SKIN_LABELS = { skinType: 'Skin type', concerns: 'Concerns', routine: 'Current routine', age: 'Age range', climate: 'Climate' };
const HAIR_LABELS = { hairType: 'Hair type', concerns: 'Concerns', wash: 'Wash frequency', treatments: 'Treatments', length: 'Length' };
const FRAGRANCE_LABELS = { families: 'Scent families', occasion: 'Occasion', seasons: 'Seasons', intensity: 'Intensity', mood: 'Mood', budget: 'Budget' };
const ACNE_LABELS = { location: 'Location', type: 'Type', duration: 'Duration', triggers: 'Triggers', tried: 'Already tried', sensitivity: 'Sensitivity' };

async function handleAnalyzeSkin(payload: { selfieImage: string; answers: Record<string, unknown> }) {
  const prompt = `You are a dermatology-informed skincare expert. Look at this selfie and the user's quiz answers, then propose a routine.

User's answers:
${formatAnswers(payload.answers, SKIN_LABELS)}

Return ONLY a JSON object with this exact structure:
{
  "observations": "1-2 sentences",
  "morning_routine": ["step 1", "..."],
  "evening_routine": ["step 1", "..."],
  "key_products": [{ "type": "cleanser", "what_to_look_for": "...", "why": "..." }],
  "habits": ["habit 1", "..."]
}

Keep each routine 4-6 steps. 3-5 key products. 3-5 habits.`;

  const parts = await callGemini(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: payload.selfieImage } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });
  return extractJson(extractText(parts));
}

async function handleAnalyzeHair(payload: { photoImage: string; answers: Record<string, unknown> }) {
  const prompt = `You are a haircare expert. Look at this hair photo and the user's quiz answers, then propose a routine.

User's answers:
${formatAnswers(payload.answers, HAIR_LABELS)}

Return ONLY a JSON object:
{
  "observations": "1-2 sentences",
  "wash_routine": "1 sentence",
  "weekly_treatments": ["treatment 1", "..."],
  "styling_tips": ["tip 1", "..."],
  "key_products": [{ "type": "shampoo", "what_to_look_for": "...", "why": "..." }]
}

2-4 treatments, 3-5 tips, 3-5 products.`;

  const parts = await callGemini(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: payload.photoImage } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });
  return extractJson(extractText(parts));
}

async function handleAnalyzeAcne(payload: { selfieImage: string; answers: Record<string, unknown> }) {
  const prompt = `You are a dermatology-informed AI assistant examining a user's selfie to help with acne. Analyse the photo and quiz answers, identify the acne pattern, and design an evidence-based routine. Then use Google Search to find 1-2 currently available real UK products.

This is informational, not medical advice.

User's quiz answers:
${formatAnswers(payload.answers, ACNE_LABELS)}

Process:
1. Identify type of acne, severity (mild/moderate/severe), distribution.
2. Cross-reference with the user's answers.
3. Build a 4-6 step routine (cleanse/treat/moisturise/SPF, with timing AM/PM).
4. Use Google Search to find 1-2 specific UK products. Prefer dermatologist-recommended brands.
5. List 2-4 things to avoid.

Return ONLY this JSON:
{
  "acne_type": "short clinical label",
  "severity": "mild" | "moderate" | "severe",
  "observations": "1-2 sentences",
  "what_helps": "1-2 sentences",
  "routine": [{ "step": "Cleanse", "what": "...", "when": "AM + PM" }],
  "products": [{ "brand": "", "name": "", "price": "£", "where": "", "why": "" }],
  "avoid": ["item 1", "..."]
}

Limit routine 4-6 steps. Products 1-2 only. Real products only.`;

  const parts = await callGemini(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: payload.selfieImage } }] }],
    tools: [{ googleSearch: {} }],
  });
  return extractJson(extractText(parts));
}

async function handleDiscoverFragrances(payload: { answers: Record<string, unknown> }) {
  const prompt = `You are a fragrance consultant with current knowledge of trending and well-reviewed perfumes.

Use web search to find 3 fragrances matching these preferences:
${formatAnswers(payload.answers, FRAGRANCE_LABELS)}

Requirements:
- 3 real, currently available fragrances
- Mix classics and trending picks
- UK prices in GBP

Return ONLY this JSON:
{
  "picks": [{
    "brand": "",
    "name": "",
    "notes": { "top": [], "middle": [], "base": [] },
    "price": "£",
    "reason": "1-2 sentences",
    "trend": "e.g. TikTok viral 2025"
  }]
}`;

  const parts = await callGemini(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
  });
  return extractJson(extractText(parts));
}

async function handleAnalyzeIngredients(payload: {
  ingredientsImage?: string;
  ingredientsText?: string;
}) {
  const hasImage = typeof payload.ingredientsImage === 'string' && payload.ingredientsImage.length > 0;
  const hasText = typeof payload.ingredientsText === 'string' && payload.ingredientsText.trim().length > 0;

  if (!hasImage && !hasText) {
    throw new Error('Send a photo or paste the ingredient list to analyse.');
  }

  const sourceDirective = hasImage
    ? `The image contains the INCI ingredients list on a beauty product. First, OCR every ingredient (in order — order matters because INCI lists are ranked by concentration). If the list is partially obscured, do your best with what's legible and note that the read was partial in observations. If you cannot read ANY ingredients (image is blurry, wrong subject, no text), set "score" to 0 and "summary" to "Couldn't read the ingredient list — try a clearer photo or paste the text."`
    : `The user has pasted the ingredient list as text. Treat it as the source of truth (INCI order is preserved).${
        hasText ? `\n\nPasted ingredients:\n${payload.ingredientsText}` : ''
      }`;

  const prompt = `You are a cosmetic-chemistry-informed AI evaluating a beauty product's ingredient list (skincare, haircare, makeup, fragrance — any category). You assess INCI ingredients for safety, efficacy, and suitability, then give a single 0–100 score and a clear explanation.

${sourceDirective}

How to score (be honest, not alarmist — most mainstream products are fine):
- 90–100: Genuinely excellent. Mostly well-researched actives, gentle surfactants, no concerning preservatives or sensitisers, fragrance-free or low-allergen.
- 75–89: Solid formula. A few neutral fillers but nothing problematic.
- 60–74: Acceptable. May contain common irritants (fragrance, drying alcohols, sulfates) or has limited active ingredients but isn't unsafe.
- 40–59: Mediocre. Multiple potential irritants, comedogenic ingredients, or weak formulation.
- 20–39: Poor. Several known sensitisers/irritants, harsh actives stacked together, or notable concerns.
- 0–19: Very concerning. Banned/restricted ingredients in major markets, or stacks of known harsh chemicals with no benefit.

Things to flag as concerns when present (only if actually present):
- Fragrance/parfum (especially if user has sensitive skin)
- Drying alcohols (alcohol denat, SD alcohol)
- Sulfates (SLS, SLES) — only matter for leave-on or sensitive skin
- Formaldehyde releasers (DMDM hydantoin, quaternium-15, imidazolidinyl urea)
- Methylisothiazolinone / methylchloroisothiazolinone (high allergen)
- Comedogenic oils for acne-prone (coconut oil, isopropyl myristate)
- Common allergens (limonene, linalool, citronellol) — note but don't doom the score
- Hormone-disrupting concerns where evidence is solid

Things to highlight as positives:
- Well-studied actives at effective concentrations implied by position in the list
- Niacinamide, hyaluronic acid, ceramides, peptides, vitamin C derivatives, retinoids, AHA/BHA, panthenol, centella asiatica, squalane
- Fragrance-free
- Gentle surfactants (cocamidopropyl betaine, decyl glucoside)
- Sunscreen filters (modern UV filters are great)

For each ingredient, classify as:
- "good" — beneficial active or supportive ingredient
- "neutral" — filler, base, or unremarkable
- "caution" — common irritant or only-for-some-skin-types
- "bad" — known harmful, restricted, or strong sensitiser

Return ONLY this JSON, no preamble:
{
  "score": 0-100 integer,
  "verdict": "great" | "good" | "okay" | "concerning" | "poor",
  "category_guess": "1-3 words, e.g. Moisturiser, Shampoo, Lipstick",
  "summary": "2-3 sentences explaining the score in plain English",
  "highlights": ["3-6 short bullets — what's good about it"],
  "concerns": ["0-6 short bullets — what's iffy or to avoid for some users; empty array if truly clean"],
  "ingredients": [
    { "name": "Aqua", "rating": "neutral", "role": "Solvent", "note": "Just water — the base of most water-based products." }
  ],
  "good_for": ["skin/hair type or concerns it suits, 2-4 entries"],
  "not_for": ["skin/hair type or concerns to avoid, 0-4 entries"]
}

Cap ingredients array at 30 entries (if longer, keep the first 30 in INCI order). Cap each "note" at 120 chars.`;

  const parts = hasImage
    ? await callGemini(TEXT_MODEL, {
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: payload.ingredientsImage } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      })
    : await callGemini(TEXT_MODEL, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      });
  return extractJson(extractText(parts));
}

async function handleFindProducts(payload: {
  category: 'skincare' | 'haircare';
  productType: string;
  whatToLookFor: string;
  why: string;
  userAnswers?: Record<string, unknown>;
}) {
  const labels = payload.category === 'skincare' ? SKIN_LABELS : HAIR_LABELS;
  const ctx = payload.userAnswers ? `\nUser context:\n${formatAnswers(payload.userAnswers, labels)}` : '';

  const prompt = `You are a beauty product specialist. The user has been given a ${payload.category} routine that includes:

Type: ${payload.productType}
What to look for: ${payload.whatToLookFor}
Why: ${payload.why}${ctx}

Use Google Search to find 2-3 specific real ${payload.category} products currently available in the UK that match closely.

Preferences:
- Mix budget and mid-range
- Dermatologist-recommended brands
- Currently sold in the UK

Return ONLY this JSON:
{
  "products": [{
    "brand": "",
    "name": "",
    "price": "£",
    "where": "",
    "why": "1-2 sentences"
  }]
}

2-3 products only. Real names. Current UK prices.`;

  const parts = await callGemini(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
  });
  return extractJson(extractText(parts));
}

// ============================================================================
// Main handler
// ============================================================================

// Tasks that read state without consuming a credit (status checks, etc.)
const FREE_TASKS = new Set(['get-job-status']);

// Boot banner — printed once per cold start. Makes it instantly obvious in
// the Supabase logs which deploy is live and which models route where.
// Look for this line in the logs after deploy to confirm the new code is up.
console.log(
  `[boot] blendrr-ai live | beauty=${OPENAI_IMAGE_MODEL} @ ${IMAGE_QUALITY} | clothing=fal.ai/nano-banana-2/edit | text=${TEXT_MODEL} | rev=2026-05-25-simple-prompts`,
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, userId, payload } = await req.json();

    if (!userId) return json({ error: 'Missing userId' }, 400);
    if (!task) return json({ error: 'Missing task' }, 400);

    // Always log the incoming task so we can correlate this entry with
    // the try-on logs that follow. If you don't see a [try-on] line after
    // this for a beauty/clothing request, the request failed before reaching
    // handleTryOn (auth, credit check, etc.).
    console.log(`[dispatch] task=${task} userId=${userId.slice(0, 8)}…`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ===== get-job-status: free, no credit check, no user verification beyond
    // ownership check on the job row. Used by client polling.
    if (task === 'get-job-status') {
      const jobId = payload?.jobId;
      if (!jobId) return json({ error: 'Missing jobId' }, 400);
      const { data: job, error: jobError } = await supabase
        .from('tryon_jobs')
        .select('id, status, result_image_base64, partial_image_base64, shade, error, credits_charged, created_at, completed_at')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();
      if (jobError || !job) return json({ error: 'Job not found' }, 404);

      // Always echo current user credits so the client can refresh balance.
      const { data: u } = await supabase
        .from('users')
        .select('credits, tier')
        .eq('id', userId)
        .single();

      return json({
        result: job,
        credits: u?.credits ?? 0,
        tier: u?.tier ?? 'free',
      });
    }

    // Load user (required for all credit-consuming tasks)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, credits, tier')
      .eq('id', userId)
      .single();

    if (userError || !user) return json({ error: 'User not found' }, 401);

    // Credit cost — flat 1 credit per AI action for free users. New users
    // get 5 free uses (see schema default). Pro users bypass the credit
    // system entirely — they're billed monthly by Apple and have unlimited
    // access for the duration of their subscription.
    const isPro = user.tier === 'pro';
    const creditCost = isPro ? 0 : 1;

    if (!isPro && user.credits < creditCost) {
      return json({ error: 'Out of credits', credits: user.credits, required: creditCost }, 402);
    }

    // ===== try-on goes async: deduct credits up front, create job row,
    // continue work via EdgeRuntime.waitUntil, return jobId immediately.
    if (task === 'try-on') {
      // Deduct credits up front; refunded by the background worker on failure.
      const { data: deducted } = await supabase
        .from('users')
        .update({ credits: user.credits - creditCost })
        .eq('id', userId)
        .select('credits, tier')
        .single();

      // Create the job row
      const { data: job, error: jobErr } = await supabase
        .from('tryon_jobs')
        .insert({
          user_id: userId,
          status: 'pending',
          task: 'try-on',
          credits_charged: creditCost,
        })
        .select('id')
        .single();

      if (jobErr || !job) {
        // Roll back the credit deduction if we couldn't create the job
        await supabase
          .from('users')
          .update({ credits: user.credits })
          .eq('id', userId);
        console.log(`[try-on] could not create job row:`, jobErr);
        return json({
          error: `Could not create try-on job: ${jobErr?.message ?? 'unknown DB error'}`,
        }, 500);
      }

      // Process in the background. Response is sent immediately; this promise
      // keeps the worker alive past the response until generation completes.
      // EdgeRuntime.waitUntil is the Supabase Edge Functions equivalent of
      // Cloudflare Workers' waitUntil — supports long-running background tasks.
      // @ts-expect-error: EdgeRuntime is provided by the Supabase runtime
      EdgeRuntime.waitUntil((async () => {
        try {
          await supabase
            .from('tryon_jobs')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', job.id);

          // onPartial: each streamed preview frame from OpenAI gets persisted
          // to the job row. The client polls and renders the latest partial
          // until the final image arrives. Fire-and-forget; we don't await
          // the DB write so it never blocks the generation pipeline.
          const result = await handleTryOn(payload, (partialB64) => {
            supabase
              .from('tryon_jobs')
              .update({ partial_image_base64: partialB64 })
              .eq('id', job.id)
              .then(({ error }) => {
                if (error) console.log(`[try-on] partial write failed: ${error.message}`);
              });
          });

          await supabase
            .from('tryon_jobs')
            .update({
              status: 'complete',
              result_image_base64: result.imageBase64,
              partial_image_base64: null,
              shade: result.shade,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          console.log(`[try-on] job ${job.id} failed: ${errMsg}`);

          // Refund credits on failure (re-read user since balance may have
          // changed between our deduction and the failure)
          const { data: refundUser } = await supabase
            .from('users')
            .select('credits')
            .eq('id', userId)
            .single();
          if (refundUser) {
            await supabase
              .from('users')
              .update({ credits: refundUser.credits + creditCost })
              .eq('id', userId);
          }

          await supabase
            .from('tryon_jobs')
            .update({
              status: 'failed',
              error: errMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        }
      })());

      // Respond immediately with the jobId. Client polls for completion.
      return json({
        result: { jobId: job.id, status: 'pending' },
        credits: deducted?.credits ?? user.credits - creditCost,
        tier: deducted?.tier ?? user.tier,
        creditsCharged: creditCost,
      });
    }

    // ===== Synchronous tasks (quizzes, fragrance, ingredient scan, find-products)
    let result: unknown;
    switch (task) {
      case 'analyze-skin':
        result = await handleAnalyzeSkin(payload);
        break;
      case 'analyze-hair':
        result = await handleAnalyzeHair(payload);
        break;
      case 'analyze-acne':
        result = await handleAnalyzeAcne(payload);
        break;
      case 'discover-fragrances':
        result = await handleDiscoverFragrances(payload);
        break;
      case 'find-products':
        result = await handleFindProducts(payload);
        break;
      case 'analyze-ingredients':
        result = await handleAnalyzeIngredients(payload);
        break;
      default:
        return json({ error: `Unknown task: ${task}` }, 400);
    }

    // Deduct credits on success for sync tasks
    const { data: updated } = await supabase
      .from('users')
      .update({ credits: user.credits - creditCost })
      .eq('id', userId)
      .select('credits, tier')
      .single();

    return json({
      result,
      credits: updated?.credits ?? user.credits - creditCost,
      tier: updated?.tier ?? user.tier,
      creditsCharged: creditCost,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = (e as { status?: number })?.status ?? 500;
    return json({ error: message }, status);
  }
});

// Type-check helper so TypeScript doesn't complain about unused export
void FREE_TASKS;
