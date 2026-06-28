import { getSupabaseAdmin } from './supabase/client';

export interface UsageRecord {
  extractionsCount: number;
  tokensOut: number;
}

export interface TierLimits {
  extractionsPerMonth: number;
}

// Returns "YYYY-MM-DD" for the first day of the current UTC month
export function getPeriodStart(date = new Date()): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// Returns ISO string for the first day of the NEXT UTC month (for reset_at)
export function getPeriodEnd(date = new Date()): string {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getTierLimits(_userId?: string): TierLimits {
  // Phase 2: everyone on free tier. Phase 5 will check subscriptions table.
  return {
    extractionsPerMonth: parseInt(
      process.env.TIER_FREE_EXTRACTIONS_PER_MONTH ?? '100',
      10
    ),
  };
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
  const limits = getTierLimits(userId);
  const { extractionsCount } = await getUsage(userId, period);

  return {
    allowed: extractionsCount < limits.extractionsPerMonth,
    used: extractionsCount,
    limit: limits.extractionsPerMonth,
    resetAt,
  };
}
