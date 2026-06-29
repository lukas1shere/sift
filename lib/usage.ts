import { getSupabaseAdmin } from './supabase/client';
import { getUserTier, TIER_LIMITS } from './stripe';

export interface UsageRecord {
  extractionsCount: number;
  tokensOut: number;
}

export interface TierLimits {
  extractionsPerMonth: number;
}

export function getPeriodStart(date = new Date()): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function getPeriodEnd(date = new Date()): string {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getTierLimits(userId: string): Promise<TierLimits> {
  const tier = await getUserTier(userId);
  return { extractionsPerMonth: TIER_LIMITS[tier].extractionsPerMonth };
}

export async function getUsage(userId: string, period: string): Promise<UsageRecord> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('usage')
    .select('extractions_count, tokens_out')
    .eq('user_id', userId)
    .eq('period_start', period)
    .single();

  return {
    extractionsCount: data?.extractions_count ?? 0,
    tokensOut: data?.tokens_out ?? 0,
  };
}

export async function incrementUsage(
  userId: string,
  period: string,
  tokens: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_period: period,
    p_tokens: tokens,
  });
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
}

export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  const period = getPeriodStart();
  const resetAt = getPeriodEnd();
  const limits = await getTierLimits(userId);
  const { extractionsCount } = await getUsage(userId, period);

  return {
    allowed: extractionsCount < limits.extractionsPerMonth,
    used: extractionsCount,
    limit: limits.extractionsPerMonth,
    resetAt,
  };
}
