import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { deleteWebhook } from '@/lib/sources';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });

  const { id } = await params;
  const ok = await deleteWebhook(id, auth.userId).catch(() => false);
  if (!ok) return NextResponse.json({ error: 'Webhook not found', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
