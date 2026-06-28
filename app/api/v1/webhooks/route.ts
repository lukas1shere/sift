import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { listWebhooks, createWebhook } from '@/lib/sources';

export const runtime = 'nodejs';

const VALID_EVENTS = ['source.changed', 'source.unchanged', 'source.error'];

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  const webhooks = await listWebhooks(auth.userId).catch(() => []);
  return NextResponse.json({ webhooks });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const { url, events } = body;
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required', code: 'INVALID_URL' }, { status: 422 });
  }
  try { new URL(url); } catch {
    return NextResponse.json({ error: 'url must be a valid URL', code: 'INVALID_URL' }, { status: 422 });
  }

  const resolvedEvents = Array.isArray(events)
    ? events.filter((e) => typeof e === 'string' && VALID_EVENTS.includes(e))
    : ['source.changed'];
  if (resolvedEvents.length === 0) {
    return NextResponse.json({ error: 'No valid events specified', code: 'INVALID_EVENTS' }, { status: 422 });
  }

  try {
    const webhook = await createWebhook(auth.userId, url, resolvedEvents);
    return NextResponse.json({
      ...webhook,
      url,
      events: resolvedEvents,
      note: 'Save the secret — it is shown only once and used to verify webhook signatures.',
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Database error', code: 'DB_ERROR' }, { status: 503 });
  }
}
