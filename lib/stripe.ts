import Stripe from 'stripe';
import { getSupabaseAdmin } from './supabase/client';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder');

// ── Tier definitions (single source of truth) ─────────────────────────────────
export const TIER_LIMITS = {
  free: {
    name: 'Free',
    price: 0,
    extractionsPerMonth: parseInt(process.env.TIER_FREE_EXTRACTIONS_PER_MONTH ?? '100', 10),
    maxSources: parseInt(process.env.TIER_FREE_SOURCES ?? '2', 10),
    minScheduleInterval: parseInt(process.env.TIER_FREE_MIN_SCHEDULE_INTERVAL ?? '86400', 10),
    features: ['100 extractions/mo', '2 watched sources', 'Daily schedule', 'API access'],
  },
  pro: {
    name: 'Pro',
    price: 19,
    extractionsPerMonth: parseInt(process.env.TIER_PRO_EXTRACTIONS_PER_MONTH ?? '5000', 10),
    maxSources: parseInt(process.env.TIER_PRO_SOURCES ?? '50', 10),
    minScheduleInterval: parseInt(process.env.TIER_PRO_MIN_SCHEDULE_INTERVAL ?? '3600', 10),
    features: ['5,000 extractions/mo', '50 watched sources', 'Hourly schedule', 'Webhooks', 'Full history'],
  },
  team: {
    name: 'Team',
    price: 99,
    extractionsPerMonth: parseInt(process.env.TIER_TEAM_EXTRACTIONS_PER_MONTH ?? '50000', 10),
    maxSources: parseInt(process.env.TIER_TEAM_SOURCES ?? '500', 10),
    minScheduleInterval: parseInt(process.env.TIER_TEAM_MIN_SCHEDULE_INTERVAL ?? '900', 10),
    features: ['50,000 extractions/mo', '500 watched sources', 'Every 15 min', 'Priority support'],
  },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

export function tierFromPriceId(priceId: string): Tier {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_TEAM_PRICE_ID) return 'team';
  return 'free';
}

// ── DB helpers ────────────────────────────────────────────────────────────────
export async function getUserTier(userId: string): Promise<Tier> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .single();
    if (!data || !['active', 'trialing'].includes(data.status)) return 'free';
    return (data.tier as Tier) ?? 'free';
  } catch {
    return 'free';
  }
}

export async function getSubscription(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function upsertSubscription(opts: {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier: Tier;
  status: string;
  currentPeriodEnd?: Date;
}) {
  const supabase = getSupabaseAdmin();
  await supabase.from('subscriptions').upsert(
    {
      user_id: opts.userId,
      stripe_customer_id: opts.stripeCustomerId,
      stripe_subscription_id: opts.stripeSubscriptionId,
      tier: opts.tier,
      status: opts.status,
      current_period_end: opts.currentPeriodEnd?.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

// ── Stripe customer helpers ───────────────────────────────────────────────────
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const sub = await getSubscription(userId);
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  await upsertSubscription({
    userId,
    stripeCustomerId: customer.id,
    tier: 'free',
    status: 'active',
  });

  return customer.id;
}

export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
  priceId: string;
  returnUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(opts.userId, opts.email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: `${opts.returnUrl}?upgraded=1`,
    cancel_url: opts.returnUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: opts.userId },
    },
  });

  return session.url!;
}

export async function createPortalSession(opts: {
  userId: string;
  email: string;
  returnUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(opts.userId, opts.email);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: opts.returnUrl,
  });

  return session.url;
}
