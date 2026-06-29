'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tier } from '@/lib/stripe';

interface TierDef {
  name: string;
  price: number;
  extractionsPerMonth: number;
  maxSources: number;
  minScheduleInterval: number;
  features: readonly string[];
}

interface Props {
  currentTier: Tier;
  tiers: Record<Tier, TierDef>;
  proPriceId: string;
  teamPriceId: string;
}

const PRICE_IDS: Record<string, string> = {};

export function BillingClient({ currentTier, tiers, proPriceId, teamPriceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const priceIdFor: Record<Tier, string> = {
    free: '',
    pro: proPriceId,
    team: teamPriceId,
  };

  async function handleUpgrade(tier: Tier) {
    if (tier === 'free' || tier === currentTier) return;
    setLoading(tier);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: priceIdFor[tier],
          returnUrl: window.location.href,
        }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? 'No checkout URL');
      window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start checkout');
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading('manage');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? 'No portal URL');
      window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to open billing portal');
      setLoading(null);
    }
  }

  const tierOrder: Tier[] = ['free', 'pro', 'team'];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-white font-semibold text-base">Billing</h1>
        {currentTier !== 'free' && (
          <button
            onClick={handleManage}
            disabled={loading === 'manage'}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {loading === 'manage' ? 'Opening…' : 'Manage subscription'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tierOrder.map((tier) => {
          const t = tiers[tier];
          const isCurrent = tier === currentTier;
          const canUpgrade = tierOrder.indexOf(tier) > tierOrder.indexOf(currentTier);

          return (
            <div
              key={tier}
              className={`bg-gray-900 border rounded p-5 space-y-4 flex flex-col ${
                isCurrent ? 'border-blue-500' : 'border-gray-800'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{t.name}</span>
                  {isCurrent && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-white">
                  {t.price === 0 ? 'Free' : `$${t.price}`}
                  {t.price > 0 && <span className="text-sm text-gray-500 font-normal">/mo</span>}
                </div>
              </div>

              <ul className="space-y-1.5 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="text-xs text-gray-400 flex gap-2">
                    <span className="text-green-400 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {canUpgrade && (
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={!!loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs py-2 rounded font-semibold transition-colors"
                >
                  {loading === tier ? 'Redirecting…' : `Upgrade to ${t.name}`}
                </button>
              )}
              {isCurrent && tier === 'free' && (
                <div className="text-xs text-gray-600 text-center py-1">No card required</div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600">
        Payments processed by Stripe. Cancel anytime from the billing portal.
        Upgrades take effect immediately. Downgrades apply at the end of the billing period.
      </p>
    </div>
  );
}
