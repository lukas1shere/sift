import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { getSource, updateSource, deleteSource } from '@/lib/sources';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function err(msg: string, code: string, status: number) {
  return NextResponse.json({ error: msg, code }, { status });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return err('Invalid or missing API key', 'INVALID_API_KEY', 401);
  const { id } = await params;
  const source = await getSource(id, auth.userId).catch(() => null);
  if (!source) return err('Source not found', 'NOT_FOUND', 404);
  return NextResponse.json(source);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return err('Invalid or missing API key', 'INVALID_API_KEY', 401);
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const patch: { active?: boolean; scheduleInterval?: number | null } = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if ('schedule_interval' in body) {
    patch.scheduleInterval =
      body.schedule_interval === null ? null : Number(body.schedule_interval);
  }

  const updated = await updateSource(id, auth.userId, patch).catch(() => null);
  if (!updated) return err('Source not found', 'NOT_FOUND', 404);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) return err('Invalid or missing API key', 'INVALID_API_KEY', 401);
  const { id } = await params;
  const ok = await deleteSource(id, auth.userId).catch(() => false);
  if (!ok) return err('Source not found', 'NOT_FOUND', 404);
  return NextResponse.json({ deleted: true });
}
