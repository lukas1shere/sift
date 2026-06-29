import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { priceId, returnUrl } = await req.json();
  if (!priceId) {
    return NextResponse.json({ error: 'priceId required' }, { status: 400 });
  }

  try {
    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      priceId,
      returnUrl: returnUrl ?? `${new URL(req.url).origin}/dashboard/billing`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
