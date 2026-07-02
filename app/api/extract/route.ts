import { NextRequest, NextResponse } from 'next/server';
import { extract, FetchError } from '@/lib/extract';
import type { RenderMode, Niche } from '@/lib/extract/types';

export const runtime = 'nodejs';
export const maxDuration = 45;

// Demo rate limit: 5 requests per IP per 10 minutes
const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demo limit reached (5 per 10 min). Sign up for full API access.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, render_mode, niche } = body as Record<string, unknown>;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 422 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 422 });
  }

  const validRenderModes: RenderMode[] = ['fetch', 'playwright', 'auto'];
  const validNiches: Niche[] = ['docs', 'auto'];
  const resolvedMode: RenderMode = validRenderModes.includes(render_mode as RenderMode)
    ? (render_mode as RenderMode)
    : 'auto';
  const resolvedNiche: Niche = validNiches.includes(niche as Niche)
    ? (niche as Niche)
    : 'auto';

  try {
    const result = await extract(parsed.href, {
      renderMode: resolvedMode,
      niche: resolvedNiche,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FetchError) {
      const status = err.status === 404 ? 404 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('Extraction error:', err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
