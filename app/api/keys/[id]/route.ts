import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { revokeApiKey } from '@/lib/keys';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const { id } = await params;
  try {
    const ok = await revokeApiKey(id, auth.userId);
    if (!ok) return NextResponse.json({ error: 'Key not found', code: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ revoked: true });
  } catch {
    return NextResponse.json({ error: 'Failed to revoke key', code: 'DB_ERROR' }, { status: 503 });
  }
}
