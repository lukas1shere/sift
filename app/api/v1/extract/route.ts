import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { extract, FetchError } from '@/lib/extract';
import type { Niche, RenderMode } from '@/lib/extract/types';
import { checkQuota, getPeriodStart, incrementUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 45;

function err(msg: string, code: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: msg, code, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) {
    return err('Invalid or missing API key', 'INVALID_API_KEY', 401);
  }

  // ── Quota ─────────────────────────────────────────────────────────────────
  let quota;
  try {
    quota = await checkQuota(auth.userId);
  } catch {
    return err('Service unavailable (database)', 'DB_ERROR', 503);
  }

  if (!quota.allowed) {
    return err('Monthly extraction quota exceeded', 'QUOTA_EXCEEDED', 429, {
      limit: quota.limit,
      used: quota.used,
      reset_at: quota.resetAt,
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body', 'BAD_REQUEST', 400);
  }

  const { url, render_mode, niche } = body as Record<string, unknown>;

  if (!url || typeof url !== 'string') {
    return err('url is required', 'INVALID_URL', 422);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return err('url must be a valid http/https URL', 'INVALID_URL', 422);
  }

  const validRenderModes: RenderMode[] = ['fetch', 'playwright', 'auto'];
  const validNiches: Niche[] = ['docs', 'auto'];
  const resolvedMode: RenderMode = validRenderModes.includes(render_mode as RenderMode)
    ? (render_mode as RenderMode)
    : 'auto';
  const resolvedNiche: Niche = validNiches.includes(niche as Niche)
    ? (niche as Niche)
    : 'auto';

  // ── Extract ───────────────────────────────────────────────────────────────
  let result;
  try {
    result = await extract(parsedUrl.href, { renderMode: resolvedMode, niche: resolvedNiche });
  } catch (extractErr) {
    if (extractErr instanceof FetchError) {
      const status = extractErr.status === 404 ? 404 : 502;
      return err(extractErr.message, extractErr.code ?? 'FETCH_ERROR', status);
    }
    console.error('[v1/extract] Unexpected error:', extractErr);
    return err('Extraction failed', 'INTERNAL_ERROR', 500);
  }

  // ── Increment usage (after success) ──────────────────────────────────────
  incrementUsage(auth.userId, getPeriodStart(), result.tokenCount).catch((e) =>
    console.error('[v1/extract] Usage increment failed:', e)
  );

  return NextResponse.json({
    url: result.url,
    title: result.title,
    description: result.description,
    markdown: result.markdown,
    json: result.json,
    content_hash: result.contentHash,
    token_count: result.tokenCount,
    render_mode: result.renderMode,
    meta: result.meta,
    _quota: {
      used: quota.used + 1,
      limit: quota.limit,
      reset_at: quota.resetAt,
    },
  });
}
