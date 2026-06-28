import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { checkQuota } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or missing API key', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  try {
    const quota = await checkQuota(auth.userId);
    return NextResponse.json({
      extractions: {
        used: quota.used,
        limit: quota.limit,
        remaining: Math.max(0, quota.limit - quota.used),
      },
      reset_at: quota.resetAt,
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable', code: 'DB_ERROR' }, { status: 503 });
  }
}
