import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import {
  createSource,
  listSources,
  getMaxSources,
  getMinScheduleInterval,
} from '@/lib/sources';

export const runtime = 'nodejs';

function err(msg: string, code: string, status: number) {
  return NextResponse.json({ error: msg, code }, { status });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return err('Invalid or missing API key', 'INVALID_API_KEY', 401);

  try {
    const sources = await listSources(auth.userId);
    return NextResponse.json({ sources });
  } catch {
    return err('Database error', 'DB_ERROR', 503);
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return err('Invalid or missing API key', 'INVALID_API_KEY', 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err('Invalid JSON body', 'BAD_REQUEST', 400); }

  const { url, niche, render_mode, schedule_interval } = body;

  if (!url || typeof url !== 'string') return err('url is required', 'INVALID_URL', 422);
  try {
    const p = new URL(url as string);
    if (!['http:', 'https:'].includes(p.protocol)) throw new Error();
  } catch { return err('url must be a valid http/https URL', 'INVALID_URL', 422); }

  // Enforce max sources per tier
  try {
    const existing = await listSources(auth.userId);
    const maxSources = getMaxSources(auth.userId);
    if (existing.length >= maxSources) {
      return err(
        `Source limit reached (${maxSources}). Upgrade to add more.`,
        'SOURCE_LIMIT_EXCEEDED',
        429
      );
    }

    const scheduleInterval =
      schedule_interval != null && typeof schedule_interval === 'number'
        ? Math.max(schedule_interval, getMinScheduleInterval(auth.userId))
        : null;

    const source = await createSource(auth.userId, {
      url: url as string,
      niche: typeof niche === 'string' ? niche : 'auto',
      renderMode: typeof render_mode === 'string' ? render_mode : 'auto',
      scheduleInterval,
    });

    return NextResponse.json(source, { status: 201 });
  } catch {
    return err('Database error', 'DB_ERROR', 503);
  }
}
