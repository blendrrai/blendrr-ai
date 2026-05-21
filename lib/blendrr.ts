import * as ImageManipulator from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { ensureUserId, getCachedUser, updateCachedUser } from './user';
import type { Zone } from './theme';
import type { Answers } from '../components/Questionnaire';

// ============================================================================
// Edge Function dispatcher
// ============================================================================

type EdgeResponse<T> = {
  result?: T;
  credits?: number;
  tier?: 'free' | 'pro';
  error?: string;
};

async function extractEdgeError(error: unknown): Promise<string> {
  if (!error) return 'Unknown error';
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const text = await ctx.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) return String(parsed.error);
        if (parsed?.message) return String(parsed.message);
      } catch {
        if (text) return text.slice(0, 300);
      }
    } catch {
      // ignore
    }
  }
  const message = (error as { message?: string }).message;
  return message ?? 'Unknown Edge Function error';
}

async function callEdge<T>(task: string, payload: unknown): Promise<T> {
  const userId = getCachedUser()?.id ?? (await ensureUserId());

  const { data, error } = await supabase.functions.invoke<EdgeResponse<T>>('blendrr-ai', {
    body: { task, userId, payload },
  });

  if (error) {
    const message = await extractEdgeError(error);
    if (message === 'Out of credits') {
      throw new Error("You're out of credits. Top up or upgrade to Pro to keep going.");
    }
    if (message === 'User not found') {
      throw new Error('Your account isn\'t set up yet — close the app and reopen to retry.');
    }
    throw new Error(message);
  }
  if (!data) throw new Error('Empty response from Edge Function');
  if (data.error) {
    if (data.error === 'Out of credits') {
      throw new Error("You're out of credits. Top up or upgrade to Pro to keep going.");
    }
    throw new Error(data.error);
  }

  // Server is source of truth for credits/tier — refresh local cache
  if (typeof data.credits === 'number') {
    updateCachedUser({ credits: data.credits, ...(data.tier ? { tier: data.tier } : {}) });
  }

  if (data.result === undefined || data.result === null) {
    throw new Error('Edge Function returned no result');
  }
  return data.result;
}

// ============================================================================
// Image helpers
// ============================================================================

async function uriToBase64(uri: string, maxDim = 1024): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDim } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!result.base64) throw new Error('Failed to encode image');
  return result.base64;
}

function base64ToBytes(b64: string): Uint8Array {
  // Hermes (RN engine) has global atob — decode then convert each char to a byte
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function writeImageToDisk(base64: string, prefix: string): string {
  const filename = `${prefix}-${Date.now()}.jpg`;
  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  file.write(base64ToBytes(base64));
  return file.uri;
}

// ============================================================================
// Public API — same shapes as before, now backed by Edge Function
// ============================================================================

export type TryOnInput = {
  selfieUri: string;
  /** One product for single mode, up to 5 for multi mode. */
  productUris: string[];
  /** Zone of the single product (ignored / unused in multi mode). */
  zone: Zone;
  /** 'single' = one product, one zone. 'multi' = full-face, up to 5 products, AI figures out where each goes. */
  mode: 'single' | 'multi';
  quality?: 'medium' | 'ultra';
};

type ShadeInfo = {
  hex: string;
  description: string;
  finish: string;
};

/** Persisted state for an in-flight try-on. Survives app restarts. */
export type ActiveTryOnJob = {
  jobId: string;
  zone: Zone;
  mode: 'single' | 'multi';
  quality: 'medium' | 'ultra';
  createdAt: number;
};

const ACTIVE_JOB_KEY = 'blendrr.activeTryOnJob.v1';

/**
 * Submit a try-on request. Returns immediately with a jobId — the actual AI
 * generation happens server-side in the background. Use pollTryOnJob() to
 * fetch progress + result.
 *
 * The jobId is persisted to AsyncStorage so a partially-finished try-on can
 * be recovered after backgrounding, screen unmount, or app restart.
 */
export async function startTryOn({
  selfieUri,
  productUris,
  zone,
  mode,
  quality = 'medium',
}: TryOnInput): Promise<ActiveTryOnJob> {
  if (productUris.length === 0) throw new Error('Add at least one product.');

  const [selfieImage, ...productImages] = await Promise.all([
    uriToBase64(selfieUri, 1024),
    ...productUris.map((uri) => uriToBase64(uri, 1024)),
  ]);

  const payload: {
    selfieImage: string;
    productImage?: string;
    productImages?: string[];
    zone: Zone;
    mode: 'single' | 'multi';
    quality: 'medium' | 'ultra';
  } = { selfieImage, zone, mode, quality };
  if (mode === 'single') {
    payload.productImage = productImages[0];
  } else {
    payload.productImages = productImages;
  }

  const result = await callEdge<{ jobId: string; status: string }>('try-on', payload);

  const job: ActiveTryOnJob = {
    jobId: result.jobId,
    zone,
    mode,
    quality,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job));
  return job;
}

export type TryOnJobStatus =
  | { kind: 'pending' | 'processing' }
  | { kind: 'complete'; resultUri: string; shade: ShadeInfo | null }
  | { kind: 'failed'; error: string };

/** Single fetch — returns current status. Caller decides whether to poll again. */
export async function pollTryOnJob(jobId: string): Promise<TryOnJobStatus> {
  type JobRow = {
    id: string;
    status: 'pending' | 'processing' | 'complete' | 'failed';
    result_image_base64: string | null;
    shade: ShadeInfo | null;
    error: string | null;
    credits_charged: number;
  };
  const job = await callEdge<JobRow>('get-job-status', { jobId });
  if (job.status === 'pending' || job.status === 'processing') {
    return { kind: job.status };
  }
  if (job.status === 'failed') {
    return { kind: 'failed', error: job.error ?? 'Try-on failed.' };
  }
  // status === 'complete'
  if (!job.result_image_base64) {
    return { kind: 'failed', error: 'Job completed without an image.' };
  }
  const resultUri = writeImageToDisk(job.result_image_base64, 'tryon');
  return { kind: 'complete', resultUri, shade: job.shade };
}

export async function getActiveTryOnJob(): Promise<ActiveTryOnJob | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_JOB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveTryOnJob;
  } catch {
    return null;
  }
}

export async function clearActiveTryOnJob(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_JOB_KEY);
}

export type SkinAnalysis = {
  observations: string;
  morning_routine: string[];
  evening_routine: string[];
  key_products: { type: string; what_to_look_for: string; why: string }[];
  habits: string[];
};

export async function analyzeSkin(opts: { selfieUri: string; answers: Answers }): Promise<SkinAnalysis> {
  const selfieImage = await uriToBase64(opts.selfieUri, 1024);
  return callEdge<SkinAnalysis>('analyze-skin', {
    selfieImage,
    answers: opts.answers,
  });
}

export type HairAnalysis = {
  observations: string;
  wash_routine: string;
  weekly_treatments: string[];
  styling_tips: string[];
  key_products: { type: string; what_to_look_for: string; why: string }[];
};

export async function analyzeHair(opts: { photoUri: string; answers: Answers }): Promise<HairAnalysis> {
  const photoImage = await uriToBase64(opts.photoUri, 1024);
  return callEdge<HairAnalysis>('analyze-hair', {
    photoImage,
    answers: opts.answers,
  });
}

export type AcneRoutineStep = { step: string; what: string; when: string };
export type AcneProduct = { brand: string; name: string; price: string; where: string; why: string };

export type AcneAnalysis = {
  acne_type: string;
  severity: 'mild' | 'moderate' | 'severe';
  observations: string;
  what_helps: string;
  routine: AcneRoutineStep[];
  products: AcneProduct[];
  avoid: string[];
};

export async function analyzeAcne(opts: { selfieUri: string; answers: Answers }): Promise<AcneAnalysis> {
  const selfieImage = await uriToBase64(opts.selfieUri, 1024);
  return callEdge<AcneAnalysis>('analyze-acne', {
    selfieImage,
    answers: opts.answers,
  });
}

export type FoundProduct = {
  brand: string;
  name: string;
  price: string;
  where: string;
  why: string;
};

export async function findProductsForRecommendation(opts: {
  category: 'skincare' | 'haircare';
  productType: string;
  whatToLookFor: string;
  why: string;
  userAnswers?: Answers;
}): Promise<FoundProduct[]> {
  const result = await callEdge<{ products: FoundProduct[] }>('find-products', {
    category: opts.category,
    productType: opts.productType,
    whatToLookFor: opts.whatToLookFor,
    why: opts.why,
    userAnswers: opts.userAnswers,
  });
  return result.products ?? [];
}

export type FragrancePick = {
  brand: string;
  name: string;
  notes: { top: string[]; middle: string[]; base: string[] };
  price: string;
  reason: string;
  trend: string;
};

export type FragranceResult = {
  picks: FragrancePick[];
};

export async function discoverFragrances(opts: { answers: Answers }): Promise<FragranceResult> {
  return callEdge<FragranceResult>('discover-fragrances', {
    answers: opts.answers,
  });
}

export type IngredientRating = 'good' | 'neutral' | 'caution' | 'bad';
export type IngredientVerdict = 'great' | 'good' | 'okay' | 'concerning' | 'poor';

export type IngredientRow = {
  name: string;
  rating: IngredientRating;
  role: string;
  note: string;
};

export type IngredientAnalysis = {
  score: number;
  verdict: IngredientVerdict;
  category_guess: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  ingredients: IngredientRow[];
  good_for: string[];
  not_for: string[];
};

export async function analyzeIngredients(opts: {
  photoUri?: string;
  text?: string;
}): Promise<IngredientAnalysis> {
  const payload: { ingredientsImage?: string; ingredientsText?: string } = {};
  if (opts.photoUri) {
    payload.ingredientsImage = await uriToBase64(opts.photoUri, 1280);
  }
  if (opts.text && opts.text.trim().length > 0) {
    payload.ingredientsText = opts.text.trim();
  }
  if (!payload.ingredientsImage && !payload.ingredientsText) {
    throw new Error('Add a photo or paste the ingredient list first.');
  }
  return callEdge<IngredientAnalysis>('analyze-ingredients', payload);
}
