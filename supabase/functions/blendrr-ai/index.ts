// Supabase Edge Function: blendrr-ai
// AI calls fan out to: Gemini (text/vision, shade extraction, quizzes,
// search-grounded discovery) and OpenAI (image edits / try-on). Clients
// never see either API key.
// Deploy: `supabase functions deploy blendrr-ai`

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TEXT_MODEL = 'gemini-2.5-flash';
// Try-on image edits go through OpenAI's gpt-image-2 (newer GA model used by
// ChatGPT). If unavailable on the account, automatic fallback to gpt-image-1.
const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const OPENAI_IMAGE_FALLBACK = 'gpt-image-1';
// Final-tier fallback if OpenAI itself is unreachable. Gemini Nano Banana 2.5
// is GA and consistently returns an image (even if quality is lower).
const GEMINI_IMAGE_FALLBACK = 'gemini-2.5-flash-image';

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
 */
async function callOpenAIImageEdit(opts: {
  model: string;
  prompt: string;
  images: { data: string; mime?: string }[];
  quality?: 'low' | 'medium' | 'high' | 'auto';
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
}): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const formData = new FormData();
  formData.append('model', opts.model);
  formData.append('prompt', opts.prompt);
  formData.append('n', '1');
  formData.append('size', opts.size ?? 'auto');
  formData.append('quality', opts.quality ?? 'high');

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

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');
  return b64;
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

const FINISH_VISUAL: Record<string, string> = {
  matte: 'no shine, soft and powdery, completely flat reflectance',
  satin: 'subtle natural sheen, smooth but not wet',
  glossy: 'wet, reflective, light-catching, mirror-like highlights',
  shimmer: 'visible glitter or sparkle particles within the shade',
  metallic: 'chrome or foil-like, extremely reflective',
  sheer: 'translucent, low pigment',
};

async function handleDescribeShade(payload: { productImage: string; zone: string }) {
  const prompt = `You are a colour-matching specialist for a beauty app. Analyse this image of a cosmetic product (for ${payload.zone}) and return the EXACT hex code of the TRUE makeup shade — the shade as a brand would print it on a colour-block swatch card, NOT how it appears in this specific photo.

PRIORITY ORDER for reading (use the highest available source):
1. SWATCH BLOCK on white background (brand stock image) — read directly, this IS the true shade
2. SWATCH on skin/paper — read directly, then mentally brighten ~10% to remove skin undertone bleed
3. PRODUCT BULLET/PAN visible — read the brightest, most evenly-lit point of the product itself, ignoring shadow side
4. APPLIED PRODUCT on a model's lips/skin — read from the brightest application area, then brighten by 15-20% to compensate for lip wetness, skin tone, and lighting darkening
5. PACKAGING ONLY (caps, tubes) — last resort, infer best estimate

CRITICAL accuracy rules:
- The hex you return represents the shade in PERFECT NEUTRAL LIGHTING. Photo lighting almost always darkens what you see. ERR LIGHTER, NOT DARKER.
- For nude / pink-toned lipsticks like Pillow Talk Medium, MAC Velvet Teddy, etc — these read as warm pinkish-browns around #B07060 to #C88575. If you find yourself returning anything below #8B5040, you are probably reading shadow, re-sample.
- For bold reds, full-pigment shades will be saturated (high chroma). If your hex has R, G, B all under 100, you're reading shadow not pigment.
- For deep berry/wine shades, do read them dark — but again, sample the BRIGHTEST point.
- DO NOT average across the image. Pick the single brightest, least-shadowed pixel area and read THAT.

IGNORE entirely: tube/bottle/cap material colour, brand labels, background, photo lighting cast, white specular highlights, reflections, watermarks.

Finish definitions:
- matte: no shine, soft and powdery, completely flat reflectance
- satin: subtle natural sheen, smooth but not wet
- glossy: wet, reflective, light-catching, mirror-like highlights
- shimmer: visible glitter or sparkle particles within the shade
- metallic: chrome or foil-like, extremely reflective
- sheer: translucent, low pigment

Return ONLY this JSON, no preamble:
{ "hex": "#RRGGBB", "description": "max 6 words", "finish": "matte" }`;

  const parts = await callGemini(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: payload.productImage } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });
  return extractJson<{ hex: string; description: string; finish: string }>(extractText(parts));
}

/**
 * Build the try-on prompt for the given zone. Structure follows what GPT-Image
 * responds best to: TASK / INPUTS / INSTRUCTIONS / OUTPUT STYLE blocks.
 *
 * Designed to be easy to extend later when we split `face` into sub-zones
 * (foundation, blush, concealer, contour, bronzer). Each sub-zone would get
 * its own case here with tailored INSTRUCTIONS — the TASK/INPUTS/OUTPUT shell
 * stays the same.
 */
function buildTryOnPrompt(
  zone: Zone,
  hex: string,
  description: string,
  finish: string,
): string {
  const header = `You are a professional beauty AI image editor.`;
  const outputStyle = `OUTPUT STYLE:\nUltra realistic beauty campaign / iPhone selfie realism. No glam filters, no AI artifacts, no doll-like skin, no plastic textures. The result should look like a real photo of a real person wearing real makeup.`;

  // Common preservation block — appears in every prompt with minor tweaks.
  const preserveCommon = `- Preserve the person's exact identity, facial structure, skin tone, skin texture, freckles, moles, hairstyle, lighting, shadows, and camera characteristics.
- Do NOT beautify the person, smooth the skin, alter facial proportions, or change skin tone.
- Preserve the original pose, expression, background, framing, crop, aspect ratio, and exact face position within the frame. A user comparing before and after should see the face stay still — only the target region changes.
- Avoid over-smoothing, AI artifacts, glam filters, or unrealistic skin.`;

  if (zone === 'lips') {
    return `${header}

TASK:
Apply the lipstick from the reference product image onto the person's lips in the selfie, naturally and realistically.

INPUTS:
- 1 selfie image (the first image — this is the canvas you will edit)
- 1 lipstick product image (the second image — use the lipstick bullet as the colour reference)

INSTRUCTIONS:
- Match the lipstick shade from the reference image as accurately as possible. Read the colour from the lipstick bullet itself (the cylindrical wax/cream), NOT the cap, tube, or packaging.
- The shade is approximately ${hex} (${description}) — use as a sanity check; trust the product image as the primary colour source.
- Apply the lipstick with proper opaque coverage — the natural lip colour must be fully covered. The result should clearly look like worn lipstick, not a sheer tint.
- Maintain a realistic ${finish} finish (matte = flat; satin = subtle sheen; glossy = wet/reflective; shimmer = sparkle particles).
- Apply ONLY to the lip surface with realistic edges. Do NOT change lip shape, lip line, philtrum, or surrounding skin.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'foundation') {
    return `${header}

TASK:
Apply the foundation from the reference product image onto the person's face in the selfie, naturally and realistically.

INPUTS:
- 1 selfie image (the first image — this is the canvas you will edit)
- 1 foundation product image (the second image — use the swatch or actual cream/liquid colour, NOT the bottle or labels)

INSTRUCTIONS:
- Match the foundation shade from the reference image. The shade is approximately ${hex} (${description}) — use as a sanity check; trust the product image as primary.
- Apply foundation across the ENTIRE face — forehead, temples, cheeks, nose, chin, jawline, under-eyes, blending down to the neck. NOT in patches, NOT in stripes, NOT just cheeks.
- Blend naturally into the skin while preserving pores, freckles, moles, and realistic skin texture. Do NOT over-smooth, retouch, or create doll-like skin.
- Match the product's finish (${finish}: matte = soft/flat, satin = natural smooth, dewy = subtle glow).
- Apply ONLY to the SKIN. Do NOT cover the eyes, eyelashes, eyebrows, lips, or hairline.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'concealer') {
    return `${header}

TASK:
Apply the concealer from the reference product image to the targeted areas of the person's face — under-eyes, blemishes, dark spots, redness — naturally.

INPUTS:
- 1 selfie image (the canvas)
- 1 concealer product image (use the actual cream/liquid colour as the reference)

INSTRUCTIONS:
- Match the concealer shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Apply ONLY to the typical concealer areas: under-eyes (covering any dark circles), the sides of the nose if needed, and any visible blemishes or redness on the face.
- This is TARGETED application — NOT full-face like foundation. Most of the skin should remain untouched.
- Blend the edges seamlessly so there are no visible patches or borders. The result should look like flawless natural skin, not painted-on coverage.
- Match the product's ${finish} finish — natural and skin-like, never cakey.
- Do NOT cover the eyes themselves, eyelashes, eyebrows, lips, or hairline.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'blush') {
    return `${header}

TASK:
Apply the blush from the reference product image onto the apples of the person's cheeks, naturally and realistically.

INPUTS:
- 1 selfie image (the canvas)
- 1 blush product image (powder pan, cream pot, or stick — use the actual pigment colour)

INSTRUCTIONS:
- Match the blush shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Apply ONLY to the apples of the cheeks (the rounded part that lifts when smiling), with a soft diffused edge blending up toward the temples. Optionally a very light touch on the nose tip for a "flushed" look.
- This is a SOFT WASH of colour — natural flush, not a painted stripe. The colour should look like the person is naturally a little warmed/flushed.
- Match the product's finish (${finish}: matte = soft powdery flush, satin = natural healthy glow, dewy/glossy = luminous "lit-from-within" effect).
- Do NOT extend over the eyes, lips, hairline, jaw, or full cheek area. Stay on the apples only.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'bronzer') {
    return `${header}

TASK:
Apply the bronzer from the reference product image to the perimeter of the person's face — temples, top of cheekbones, jawline, sides of the nose — for a sun-kissed warmth.

INPUTS:
- 1 selfie image (the canvas)
- 1 bronzer product image (powder pan or stick — use the actual pigment colour)

INSTRUCTIONS:
- Match the bronzer shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Apply to the areas where the sun naturally hits: temples and forehead perimeter, top of the cheekbones (NOT the apples), along the jawline, and a subtle stroke down the sides of the nose. Forms a soft "3" shape on each side of the face.
- This is a SUBTLE warming, not heavy contour. The result should look like a light tan or healthy sun-kissed glow, not painted-on shadow.
- Soft, diffused, blended edges — no visible lines.
- Match the product's finish (${finish}: matte for cleaner warmth, shimmer for a glow).
- Do NOT cover the centre of the face (forehead centre, nose bridge, apples of cheeks, chin) — that stays the natural skin tone for contrast.
- Do NOT change lips, eyes, brows, or hair.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'eyeliner') {
    return `${header}

TASK:
Apply the eyeliner from the reference product image along the person's lash lines, naturally and realistically.

INPUTS:
- 1 selfie image (the canvas)
- 1 eyeliner product image (pen tip, gel pot, or pencil — use the actual pigment colour)

INSTRUCTIONS:
- Match the eyeliner shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Apply ONLY along the upper lash line (and optionally a thin line on the lower lash line if it matches the product type). Follow the natural eye shape.
- The line should be crisp, even, and follow the lash line precisely — no shape distortion, no winged extensions beyond the natural eye contour (unless the product is clearly for that and the result still looks like normal makeup).
- Apply at the product's typical opacity for ${finish} finish.
- Do NOT change eye shape, eye size, pupil colour, iris colour, eyelash length, or surrounding skin.
- Do NOT extend the line beyond the outer corner of the eye in a dramatic wing — keep it natural and subtle unless the prompt clearly suggests a wing.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'eyeshadow') {
    return `${header}

TASK:
Apply the eyeshadow from the reference product image onto the person's eyelids, naturally and realistically.

INPUTS:
- 1 selfie image (the canvas)
- 1 eyeshadow product image (single pan or palette — use the actual pigment colour)

INSTRUCTIONS:
- Match the eyeshadow shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Apply to the eyelid (lid space from lash line up to the natural crease), with soft blending into the crease and a slight lift toward the outer corner.
- A subtle touch in the crease and along the lower lash line is fine if it suits the product, but the main concentration is on the lid.
- This should look like a wearable everyday eyeshadow, not a heavy editorial look — soft, blended, no harsh lines.
- Match the product's finish (${finish}: matte = soft and flat, shimmer/metallic = catches light, satin = subtle sheen).
- Do NOT change eye shape, eye size, lash length, brows, or surrounding skin.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'mascara') {
    return `${header}

TASK:
Apply the mascara from the reference product image to the person's eyelashes, lengthening and darkening them naturally.

INPUTS:
- 1 selfie image (the canvas)
- 1 mascara product image (tube, wand, or swatch — use the pigment colour, usually black or brown)

INSTRUCTIONS:
- Match the mascara shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Apply ONLY to the eyelashes — upper and lower lashes both visible if present in the source.
- Lashes should look darker, slightly thicker, and slightly longer/more defined — like a single coat of mascara has been applied. NOT extreme false-lash levels.
- Preserve the natural lash direction and shape. Do NOT add fake-looking spider lashes, clumps, or cartoon thickness.
- Match the product's typical look (regular = natural, volumising = thicker, lengthening = longer).
- Do NOT change eye shape, eye colour, pupil, iris, skin around the eyes, or eyebrows.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'eyebrows') {
    return `${header}

TASK:
Apply the brow product from the reference image to the person's eyebrows, filling and defining them naturally.

INPUTS:
- 1 selfie image (the canvas)
- 1 brow product image (pencil, pomade, gel, or powder — use the actual pigment colour)

INSTRUCTIONS:
- Match the brow product shade from the reference image. Approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Fill in sparse areas of the existing eyebrows so they look slightly fuller and more defined. Follow the EXISTING brow shape precisely — do NOT change brow position, arch height, length, or thickness beyond gentle filling.
- The result should look like the person has neatly groomed brows with a little extra colour — not drawn-on cartoon brows.
- Match the product's finish (${finish}: pencil = soft hair-like strokes, pomade = defined, gel = brushed-up and held).
- Do NOT change eye shape, lashes, skin tone, or any other facial feature.
- Do NOT extend the brows beyond their natural start and end points.
${preserveCommon}

${outputStyle}`;
  }

  if (zone === 'hair') {
    return `${header}

TASK:
Apply the hair colour from the reference product image onto the person's hair in the selfie, naturally and realistically.

INPUTS:
- 1 selfie image (the canvas)
- 1 hair colour product image (use the colour swatch or sample as the reference)

INSTRUCTIONS:
- Match the hair colour from the reference image as accurately as possible.
- The shade is approximately ${hex} (${description}) — use as a sanity check; trust the product image.
- Recolour the hair while preserving natural strand texture, highlights, lowlights, and dimensional colour variation that real hair has. Do NOT make the hair look flat, painted, or like a solid colour block.
- Do NOT change hair shape, length, parting, fly-aways, or hairline position.
- Apply ONLY to hair strands. Do NOT change face, skin, eyebrows, eyelashes, or background.
${preserveCommon}

${outputStyle}`;
  }

  // Exhaustiveness fallback — shouldn't be reached with valid Zone type.
  throw new Error(`Unknown zone: ${zone}`);
}

/**
 * Build the full-face multi-product prompt for OpenAI.
 * The selfie is image 1; subsequent images (2..N) are makeup products. The AI
 * identifies what each product is (lipstick, foundation, blush, etc.) and
 * applies each to its appropriate area on the face.
 */
function buildMultiTryOnPrompt(productCount: number): string {
  return `You are a professional beauty AI image editor.

TASK:
Apply a complete makeup look to the person in the selfie. The selfie is the FIRST image. The next ${productCount} image${productCount === 1 ? '' : 's'} ${productCount === 1 ? 'is' : 'are'} makeup products — identify what each one is (lipstick, foundation, concealer, blush, bronzer, eyeshadow, eyeliner, mascara, eyebrow product, etc.) and apply each to its appropriate area on the face.

INPUTS:
- Image 1: a portrait selfie (this is the canvas you will edit)
- Images 2–${productCount + 1}: makeup products (foundation/lipstick/blush/etc. — figure out what each one is from the image)

INSTRUCTIONS:
- For each product in images 2–${productCount + 1}, identify what type of makeup it is and apply it to the correct area:
  • Lipstick → lips (opaque coverage, the lipstick's exact colour, matte/satin/gloss as appropriate)
  • Foundation → entire face, blended naturally over the skin, preserving texture
  • Concealer → under-eyes and any visible blemishes (targeted, not full-face)
  • Blush → apples of the cheeks (soft diffused wash)
  • Bronzer → temples, top of cheekbones, jawline (subtle warmth, not heavy contour)
  • Eyeshadow → eyelids (lid space, with soft blending into the crease)
  • Eyeliner → along the lash line
  • Mascara → eyelashes (darken and slightly define, not extreme)
  • Eyebrow product → fill in brows following existing shape
  • Hair colour → hair strands only
- Match each product's exact colour from its image. Read the colour from the actual product (lipstick bullet, swatch, cream, powder) — NOT the cap, tube, label, or packaging.
- Apply each product realistically and proportionately. The full look should feel cohesive and wearable, like real makeup done by a professional — not a stage look.
- Preserve the person's identity, facial structure, skin texture, freckles, moles, hairstyle (unless hair colour was a product), lighting, shadows, and background. Do NOT beautify, smooth, alter proportions, or change skin tone (foundation aside).
- Preserve the original pose, expression, framing, crop, aspect ratio, and exact face position. A user comparing before and after should see the face stay still — only the applied makeup should differ.
- Avoid AI artifacts, glam filters, doll-like skin, painted-on edges, or anything that looks unnatural.

OUTPUT STYLE:
Ultra realistic beauty campaign / iPhone selfie realism. No glam filters, no AI artifacts, no doll-like skin, no plastic textures. The result should look like a real photo of a real person wearing real makeup that they've applied themselves.`;
}

async function handleTryOn(payload: {
  selfieImage: string;
  productImage?: string;
  productImages?: string[];
  zone: Zone;
  mode?: 'single' | 'multi';
  quality?: 'medium' | 'ultra';
}) {
  const mode: 'single' | 'multi' = payload.mode === 'multi' ? 'multi' : 'single';
  const quality: 'medium' | 'ultra' = payload.quality === 'ultra' ? 'ultra' : 'medium';
  const openAIQuality: 'medium' | 'high' = quality === 'ultra' ? 'high' : 'medium';

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

  // Step 1: describe shade (single mode only — skipped for multi since each
  // product has its own shade and the AI will read each visually).
  let shade: { hex: string; description: string; finish: string } | null = null;
  if (mode === 'single') {
    try {
      shade = await handleDescribeShade({ productImage: productImages[0], zone: payload.zone });
    } catch {
      throw new Error("Couldn't read the shade from that product image. Try a clearer photo or swatch.");
    }
    if (!shade?.hex || !/^#?[0-9A-Fa-f]{6}$/.test(shade.hex.trim())) {
      throw new Error("Couldn't read the shade from that product image. Try a clearer photo or swatch.");
    }
    shade.hex = shade.hex.startsWith('#') ? shade.hex : `#${shade.hex}`;
  }

  // Step 2: generate try-on image. PRIMARY: OpenAI gpt-image-2 (newer Nano
  // Banana — the same model ChatGPT uses, dramatically better preservation
  // and colour fidelity than Gemini). FALLBACK 1: gpt-image-1 (older OpenAI).
  // FALLBACK 2: Gemini Nano Banana 2.5 (in case OpenAI is unreachable).
  const openAIPrompt = mode === 'single' && shade
    ? buildTryOnPrompt(payload.zone, shade.hex, shade.description, shade.finish)
    : buildMultiTryOnPrompt(productImages.length);
  const geminiPrompt = openAIPrompt;

  let imageBase64: string | null = null;
  let lastError: string | null = null;

  // Attempt 1: OpenAI gpt-image-2 (primary). Quality routed from user choice:
  //   ultra → openai 'high' (~£0.13, ~50s, sharpest result)
  //   medium → openai 'medium' (~£0.05, ~20s, good for browsing)
  const openAIImages = [
    { data: payload.selfieImage, mime: 'image/jpeg' },
    ...productImages.map((data) => ({ data, mime: 'image/jpeg' })),
  ];
  try {
    console.log(`[try-on] attempt 1: openai ${OPENAI_IMAGE_MODEL} (${openAIQuality}, mode=${mode}, products=${productImages.length})`);
    imageBase64 = await callOpenAIImageEdit({
      model: OPENAI_IMAGE_MODEL,
      prompt: openAIPrompt,
      quality: openAIQuality,
      images: openAIImages,
    });
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'Unknown error';
    console.log(`[try-on] openai ${OPENAI_IMAGE_MODEL} failed: ${lastError}`);
  }

  // Attempt 2: OpenAI gpt-image-1 (only if 2 returned a model-not-available error)
  const modelUnavailable = lastError && (
    lastError.includes('does not exist') ||
    lastError.includes('not found') ||
    lastError.includes('model_not_found') ||
    lastError.includes('invalid_model') ||
    lastError.includes('404')
  );
  if (!imageBase64 && modelUnavailable) {
    try {
      console.log(`[try-on] attempt 2: openai ${OPENAI_IMAGE_FALLBACK} (${openAIQuality})`);
      imageBase64 = await callOpenAIImageEdit({
        model: OPENAI_IMAGE_FALLBACK,
        prompt: openAIPrompt,
        quality: openAIQuality,
        images: openAIImages,
      });
      lastError = null;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
      console.log(`[try-on] openai ${OPENAI_IMAGE_FALLBACK} failed: ${lastError}`);
    }
  }

  // Attempt 3: Gemini Nano Banana fallback (only if OpenAI is unreachable / down)
  if (!imageBase64) {
    try {
      console.log(`[try-on] attempt 3: gemini ${GEMINI_IMAGE_FALLBACK} (fallback)`);
      const parts = await callGemini(GEMINI_IMAGE_FALLBACK, {
        contents: [{
          parts: [
            { text: geminiPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: payload.selfieImage } },
            ...productImages.map((data) => ({
              inlineData: { mimeType: 'image/jpeg', data },
            })),
          ],
        }],
      });
      const imagePart = parts.find((p) => p.inlineData);
      if (imagePart?.inlineData) {
        imageBase64 = imagePart.inlineData.data;
        lastError = null;
      } else {
        lastError = `Gemini fallback returned no image. Text: ${extractText(parts).slice(0, 200)}`;
        console.log(`[try-on] ${lastError}`);
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
      console.log(`[try-on] gemini fallback failed: ${lastError}`);
    }
  }

  if (!imageBase64) {
    throw new Error(lastError ?? 'No image returned. Try a different selfie or product image.');
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, userId, payload } = await req.json();

    if (!userId) return json({ error: 'Missing userId' }, 400);
    if (!task) return json({ error: 'Missing task' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ===== get-job-status: free, no credit check, no user verification beyond
    // ownership check on the job row. Used by client polling.
    if (task === 'get-job-status') {
      const jobId = payload?.jobId;
      if (!jobId) return json({ error: 'Missing jobId' }, 400);
      const { data: job, error: jobError } = await supabase
        .from('tryon_jobs')
        .select('id, status, result_image_base64, shade, error, credits_charged, created_at, completed_at')
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

    // Variable credit cost. Try-on combines two modifiers:
    //   base                                = 1 credit
    //   + 1 if multi mode (full-face look)  = 2 credits
    //   + 1 if ultra quality                = 3 credits max
    // Non try-on tasks always cost 1 credit. Free tasks above already returned.
    let creditCost = 1;
    if (task === 'try-on') {
      if (payload?.mode === 'multi') creditCost += 1;
      if (payload?.quality === 'ultra') creditCost += 1;
    }

    if (user.credits < creditCost) {
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
        return json({ error: 'Could not create try-on job' }, 500);
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

          const result = await handleTryOn(payload);

          await supabase
            .from('tryon_jobs')
            .update({
              status: 'complete',
              result_image_base64: result.imageBase64,
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
