import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createApiKey, listApiKeys } from '@/lib/keys';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const keys = await listApiKeys(auth.userId);
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ error: 'Failed to list keys', code: 'DB_ERROR' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  let body: { name?: string } = {};
  try { body = await req.json(); } catch { /* name is optional */ }

  try {
    const newKey = await createApiKey(auth.userId, body.name?.slice(0, 64) || 'Default');
    return NextResponse.json(newKey, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create key';
    return NextResponse.json({ error: msg, code: 'DB_ERROR' }, { status: 503 });
  }
}
