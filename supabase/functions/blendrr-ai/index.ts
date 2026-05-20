// Supabase Edge Function: blendrr-ai
// All Gemini API calls go through here. Client never has the Gemini key.
// Deploy: `supabase functions deploy blendrr-ai`

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TEXT_MODEL = 'gemini-2.5-flash';
// Nano Banana 2.5 (GA) — faster and tends to preserve source images better
// than the 3.1 preview. Falls back to 3.1 only if 2.5 fails outright.
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const IMAGE_MODEL_FALLBACK = 'gemini-3.1-flash-image-preview';

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
// Task handlers
// ============================================================================

const ZONE_REGION: Record<string, string> = {
  lips: 'Only the lip surface (upper and lower lip vertices). Do NOT change lip shape, lip line, philtrum, or the skin around the mouth.',
  face: 'The natural foundation/blush coverage area — cheeks, forehead, nose bridge, chin, jawline. Apply as a thin, even wash. Do NOT smooth or retouch the skin.',
  hair: 'Only the hair strands themselves. Do NOT change hair shape, length, parting, fly-aways, or the hairline. Recolour while preserving texture.',
};

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

async function handleTryOn(payload: { selfieImage: string; productImage: string; zone: 'lips' | 'face' | 'hair' }) {
  // Step 1: describe shade
  let shade;
  try {
    shade = await handleDescribeShade({ productImage: payload.productImage, zone: payload.zone });
  } catch {
    throw new Error("Couldn't read the shade from that product image. Try a clearer photo or swatch.");
  }
  if (!shade?.hex || !/^#?[0-9A-Fa-f]{6}$/.test(shade.hex.trim())) {
    throw new Error("Couldn't read the shade from that product image. Try a clearer photo or swatch.");
  }
  const hex = shade.hex.startsWith('#') ? shade.hex : `#${shade.hex}`;

  // Step 2: generate try-on image. Multi-image input — image 1 is the selfie
  // to edit, image 2 is the product as a visual colour reference. Short prompt
  // because verbose prompts + multi-image confuses Nano Banana into returning
  // text-only output.
  const prompt = `Two images. Image 1: a portrait. Image 2: a ${payload.zone === 'lips' ? 'lipstick product' : payload.zone === 'hair' ? 'hair colour product' : 'makeup product'}.

Read the exact colour of the ${payload.zone === 'lips' ? 'lipstick bullet' : 'product'} in image 2 — ignore packaging, cap, logos, and shadows. The colour is approximately ${hex} (${shade.description}).

Edit image 1: apply that colour to the ${payload.zone === 'lips' ? 'lips' : payload.zone === 'hair' ? 'hair' : 'face (cheeks/forehead)'} as a ${shade.finish} ${payload.zone === 'lips' ? 'lipstick' : payload.zone === 'hair' ? 'hair colour' : 'makeup'}. Opaque, full coverage — the result should clearly look like ${payload.zone === 'lips' ? 'lipstick has been applied' : payload.zone === 'hair' ? 'the hair has been dyed' : 'foundation/blush has been applied'}, not a sheer tint. Match the colour from image 2 precisely — do not darken or lighten.

Preserve everything else in image 1 exactly: face, skin tone, freckles, eyes, hair (if not target), lighting, background, ${payload.zone === 'lips' ? 'lip shape' : 'shape of the target region'}. Edit ONLY the target region.

Output: the edited image 1.`;

  // Retry up to 3 times if the model returns text instead of an image (~5%
  // of the time — safety filter false positives, internal errors, timeouts).
  let imageBase64: string | null = null;
  let lastError: string | null = null;
  let textResponse: string | null = null;
  // Try primary model (3.1 preview) for the first 2 attempts. If those fail,
  // attempt 3 uses the 2.5 fallback — handles "preview model deprecated /
  // unavailable" gracefully without users seeing a broken app.
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = attempt < 2 ? IMAGE_MODEL : IMAGE_MODEL_FALLBACK;
    try {
      const parts = await callGemini(model, {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: payload.selfieImage } },
            { inlineData: { mimeType: 'image/jpeg', data: payload.productImage } },
          ],
        }],
      });
      const imagePart = parts.find((p) => p.inlineData);
      if (imagePart?.inlineData) {
        imageBase64 = imagePart.inlineData.data;
        break;
      }
      // No image returned — log what we got instead for debugging
      textResponse = extractText(parts).slice(0, 200);
      lastError = textResponse ? `No image. Model said: ${textResponse}` : 'No image returned';
      console.log(`[try-on] attempt ${attempt + 1} (${model}) returned no image. Text: ${textResponse}`);
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
      console.log(`[try-on] attempt ${attempt + 1} (${model}) threw: ${lastError}`);
      // Don't retry on safety blocks — those won't change on re-roll
      if (lastError.toLowerCase().includes('safety')) break;
    }
    // Small backoff between retries
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
  }

  if (!imageBase64) {
    throw new Error(lastError ?? 'Gemini did not return an image after 3 attempts. Try a different selfie or product image.');
  }

  return {
    imageBase64,
    shade,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, userId, payload } = await req.json();

    if (!userId) return json({ error: 'Missing userId' }, 400);
    if (!task) return json({ error: 'Missing task' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, credits, tier')
      .eq('id', userId)
      .single();

    if (userError || !user) return json({ error: 'User not found' }, 401);
    if (user.credits <= 0) return json({ error: 'Out of credits', credits: 0 }, 402);

    // Dispatch
    let result: unknown;
    switch (task) {
      case 'try-on':
        result = await handleTryOn(payload);
        break;
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

    // Deduct credit on success
    const { data: updated } = await supabase
      .from('users')
      .update({ credits: user.credits - 1 })
      .eq('id', userId)
      .select('credits, tier')
      .single();

    return json({ result, credits: updated?.credits ?? user.credits - 1, tier: updated?.tier ?? user.tier });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = (e as { status?: number })?.status ?? 500;
    return json({ error: message }, status);
  }
});
