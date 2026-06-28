import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { getSource, listSnapshots } from '@/lib/sources';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });

  const { id } = await params;
  const source = await getSource(id, auth.userId).catch(() => null);
  if (!source) return NextResponse.json({ error: 'Source not found', code: 'NOT_FOUND' }, { status: 404 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? '20'), 100);
  const snapshots = await listSnapshots(id, limit);
  return NextResponse.json({ snapshots });
}
