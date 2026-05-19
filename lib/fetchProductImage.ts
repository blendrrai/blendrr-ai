import { File, Paths } from 'expo-file-system';

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function resolveUrl(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function guessExtension(url: string, contentType: string | null): string {
  if (contentType) {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  }
  const cleaned = url.split('?')[0].split('#')[0];
  const match = /\.(png|webp|gif|jpe?g)$/i.exec(cleaned);
  if (match) return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  return 'jpg';
}

/**
 * Download a remote image to the app's cache so `expo-image-manipulator`
 * (which rejects raw https URLs) can read it. Returns the local file:// URI
 * or null if the download fails.
 */
async function downloadToCache(remoteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent': SAFARI_UA,
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type');
    const buffer = await res.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return null;

    const bytes = new Uint8Array(buffer);
    const ext = guessExtension(remoteUrl, contentType);
    const filename = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(bytes);
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * Resolve a product page (or direct image URL) to a local file:// URI of
 * the product image. Returns null if nothing usable can be fetched.
 *
 * Steps:
 *  1. If the URL itself points at an image (by extension or content-type),
 *     download it directly.
 *  2. Otherwise fetch as HTML and pull og:image / twitter:image, then
 *     download that.
 */
export async function fetchProductImage(pageUrl: string): Promise<string | null> {
  let normalized = pageUrl.trim();
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  // Quick path — the URL already looks like a direct image.
  if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(normalized)) {
    const direct = await downloadToCache(normalized);
    if (direct) return direct;
  }

  let res: Response;
  try {
    res = await fetch(normalized, {
      headers: { 'User-Agent': SAFARI_UA },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  // If the server actually served an image, save it.
  const ct = res.headers.get('content-type') ?? '';
  if (ct.startsWith('image/')) {
    try {
      const buffer = await res.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) return null;
      const bytes = new Uint8Array(buffer);
      const ext = guessExtension(normalized, ct);
      const filename = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(bytes);
      return file.uri;
    } catch {
      return null;
    }
  }

  // Otherwise parse HTML for an og:image / twitter:image tag.
  let html: string;
  try {
    html = await res.text();
  } catch {
    return null;
  }

  for (const pat of META_PATTERNS) {
    const m = html.match(pat);
    if (m?.[1]) {
      const absolute = resolveUrl(m[1], normalized);
      const local = await downloadToCache(absolute);
      if (local) return local;
    }
  }

  return null;
}
