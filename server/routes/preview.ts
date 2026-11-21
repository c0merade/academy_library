import { Router } from 'express';
import type { LinkPreview, SourceType } from '../../src/types.ts';

export const previewRouter = Router();

// In-memory TTL cache (10 min, max 100 entries) to avoid repeated network fetches
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const previewCache = new Map<string, { data: LinkPreview; expiresAt: number }>();

function getCachedPreview(url: string): LinkPreview | null {
  const entry = previewCache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    previewCache.delete(url);
    return null;
  }
  return entry.data;
}

function setCachedPreview(url: string, data: LinkPreview) {
  if (previewCache.size >= 100) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
  previewCache.set(url, { data, expiresAt: Date.now() + PREVIEW_TTL_MS });
}

function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') {
    return true;
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(lower)) {
    return true;
  }
  return false;
}

function guessSourceHint(domain: string): SourceType {
  if (domain.includes('reel.academy')) return 'reel';
  if (domain.includes('oreilly') || domain.includes('pearson') || domain.includes('manning')) {
    return 'publisher';
  }
  if (domain.includes('udemy') || domain.includes('coursera') || domain.includes('pluralsight')) {
    return 'licensed';
  }
  return 'open-access';
}

function extractMeta(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// POST /api/link-preview — Fetches Open Graph metadata from a legitimate public URL
previewRouter.post('/', async (req, res) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!rawUrl) {
    res.status(400).json({ error: 'URL is required.' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL format.' });
    return;
  }

  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || isPrivateHost(parsed.hostname)) {
    res.status(400).json({ error: 'Only public http/https URLs can be previewed.' });
    return;
  }

  const normalizedUrl = parsed.toString();
  const cached = getCachedPreview(normalizedUrl);
  if (cached) {
    res.json(cached);
    return;
  }

  const domain = parsed.hostname.replace(/^www\./, '');
  const fallback: LinkPreview = {
    url: parsed.toString(),
    title: domain,
    description: `External resource hosted on ${domain}.`,
    image: null,
    domain,
    source_hint: guessSourceHint(domain),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AcademyLibraryBot/1.0 (+https://academy.edu)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      res.json(fallback);
      return;
    }

    const html = (await response.text()).slice(0, 60_000);

    const ogTitle =
      extractMeta(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      extractMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ??
      extractMeta(html, /<title[^>]*>([^<]+)<\/title>/i);

    const ogDesc =
      extractMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
      extractMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ??
      extractMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
      extractMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    const ogImageRaw =
      extractMeta(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      extractMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    let image: string | null = null;
    if (ogImageRaw) {
      try {
        image = new URL(ogImageRaw, parsed.origin).toString();
      } catch {
        image = null;
      }
    }

    const preview: LinkPreview = {
      url: parsed.toString(),
      title: ogTitle || fallback.title,
      description: ogDesc || fallback.description,
      image,
      domain,
      source_hint: guessSourceHint(domain),
    };

    setCachedPreview(normalizedUrl, preview);
    res.json(preview);
  } catch {
    // Graceful fallback when offline or site blocks bots
    res.json(fallback);
  }
});
