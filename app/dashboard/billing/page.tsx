import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { getUserTier, TIER_LIMITS } from '@/lib/stripe';
import { BillingClient } from './BillingClient';

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const currentTier = await getUserTier(user.id).catch(() => 'free' as const);

  return (
    <BillingClient
      currentTier={currentTier}
      tiers={TIER_LIMITS}
      proPriceId={process.env.STRIPE_PRO_PRICE_ID ?? ''}
      teamPriceId={process.env.STRIPE_TEAM_PRICE_ID ?? ''}
    />
  );
}
