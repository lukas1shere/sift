import { NextRequest, NextResponse } from 'next/server';
import { stripe, tierFromPriceId, upsertSubscription } from '@/lib/stripe';

export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeSubscription = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeEvent = any;

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as { deleted?: boolean }).deleted) return null;
  return (customer as { metadata?: { supabase_user_id?: string } }).metadata?.supabase_user_id ?? null;
}

async function handleSubscriptionEvent(sub: StripeSubscription) {
  const customerId = sub.customer as string;
  const userId = await getUserIdFromCustomer(customerId);
  if (!userId) return;

  const priceId = sub.items?.data?.[0]?.price?.id ?? '';
  const tier = tierFromPriceId(priceId);
  const periodEnd = new Date((sub.current_period_end ?? 0) * 1000);

  await upsertSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    tier: sub.status === 'canceled' ? 'free' : tier,
    status: sub.status,
    currentPeriodEnd: periodEnd,
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await handleSubscriptionEvent(sub);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await handleSubscriptionEvent(event.data.object);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription as string | null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscriptionEvent(sub);
        }
        break;
      }
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
