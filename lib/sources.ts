import { getSupabaseAdmin } from './supabase/client';
import type { SemanticDiff } from './diff';
import type { ExtractResult } from './extract/types';

export interface Source {
  id: string;
  userId: string;
  url: string;
  niche: string;
  renderMode: string;
  scheduleInterval: number | null;
  nextCrawlAt: string | null;
  lastCrawlAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface SnapshotRecord {
  id: string;
  sourceId: string;
  fetchedAt: string;
  contentMarkdown: string;
  contentJson: unknown;
  contentHash: string;
  tokenCount: number;
}

export interface DiffRecord {
  id: string;
  sourceId: string;
  fromSnapshotId: string | null;
  toSnapshotId: string;
  changeSummary: string;
  addedSections: unknown[];
  removedSections: unknown[];
  changedSections: unknown[];
  changedAt: string;
}

function rowToSource(r: Record<string, unknown>): Source {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    url: r.url as string,
    niche: r.niche as string,
    renderMode: r.render_mode as string,
    scheduleInterval: r.schedule_interval as number | null,
    nextCrawlAt: r.next_crawl_at as string | null,
    lastCrawlAt: r.last_crawl_at as string | null,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

// ── Tier limit helper ─────────────────────────────────────────────────────────
// Phase 3: everyone on free tier. Phase 5 will check subscriptions.
export function getMinScheduleInterval(_userId?: string): number {
  return parseInt(process.env.TIER_FREE_MIN_SCHEDULE_INTERVAL ?? '86400', 10);
}

export function getMaxSources(_userId?: string): number {
  return parseInt(process.env.TIER_FREE_MAX_SOURCES ?? '2', 10);
}

// ── Source CRUD ───────────────────────────────────────────────────────────────
export async function createSource(
  userId: string,
  opts: { url: string; niche?: string; renderMode?: string; scheduleInterval?: number | null; name?: string }
): Promise<Source> {
  const supabase = getSupabaseAdmin();

  const minInterval = getMinScheduleInterval(userId);
  let scheduleInterval = opts.scheduleInterval ?? null;
  if (scheduleInterval !== null && scheduleInterval < minInterval) {
    scheduleInterval = minInterval;
  }

  const nextCrawlAt = scheduleInterval !== null ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('sources')
    .insert({
      user_id: userId,
      url: opts.url,
      niche: opts.niche ?? 'auto',
      render_mode: opts.renderMode ?? 'auto',
      schedule_interval: scheduleInterval,
      next_crawl_at: nextCrawlAt,
      active: true,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to create source: ${error?.message}`);
  return rowToSource(data as Record<string, unknown>);
}

export async function listSources(userId: string): Promise<Source[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('sources')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => rowToSource(r as Record<string, unknown>));
}

export async function getSource(sourceId: string, userId: string): Promise<Source | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .single();
  return data ? rowToSource(data as Record<string, unknown>) : null;
}

export async function getSourceById(sourceId: string): Promise<Source | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('sources').select('*').eq('id', sourceId).single();
  return data ? rowToSource(data as Record<string, unknown>) : null;
}

export async function updateSource(
  sourceId: string,
  userId: string,
  patch: { active?: boolean; scheduleInterval?: number | null }
): Promise<Source | null> {
  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (patch.active !== undefined) updates.active = patch.active;
  if (patch.scheduleInterval !== undefined) {
    const min = getMinScheduleInterval(userId);
    const val = patch.scheduleInterval;
    updates.schedule_interval = val !== null && val < min ? min : val;
    // Re-arm next_crawl_at if activating a schedule
    if (updates.schedule_interval !== null) {
      updates.next_crawl_at = new Date().toISOString();
    }
  }

  const { data } = await supabase
    .from('sources')
    .update(updates)
    .eq('id', sourceId)
    .eq('user_id', userId)
    .select()
    .single();

  return data ? rowToSource(data as Record<string, unknown>) : null;
}

export async function deleteSource(sourceId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', sourceId)
    .eq('user_id', userId);
  return !error;
}

// ── Snapshots ─────────────────────────────────────────────────────────────────
export async function storeSnapshot(
  sourceId: string,
  result: ExtractResult
): Promise<SnapshotRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('snapshots')
    .insert({
      source_id: sourceId,
      content_markdown: result.markdown,
      content_json: result.json,
      content_hash: result.contentHash,
      token_count: result.tokenCount,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to store snapshot: ${error?.message}`);
  return {
    id: data.id,
    sourceId: data.source_id,
    fetchedAt: data.fetched_at,
    contentMarkdown: data.content_markdown,
    contentJson: data.content_json,
    contentHash: data.content_hash,
    tokenCount: data.token_count,
  };
}

export async function getLatestSnapshot(
  sourceId: string,
  excludeId?: string
): Promise<SnapshotRecord | null> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from('snapshots')
    .select('*')
    .eq('source_id', sourceId)
    .order('fetched_at', { ascending: false })
    .limit(1);

  if (excludeId) q = q.neq('id', excludeId);

  const { data } = await q.single();
  if (!data) return null;
  return {
    id: data.id,
    sourceId: data.source_id,
    fetchedAt: data.fetched_at,
    contentMarkdown: data.content_markdown,
    contentJson: data.content_json,
    contentHash: data.content_hash,
    tokenCount: data.token_count,
  };
}

export async function listSnapshots(
  sourceId: string,
  limit = 20
): Promise<Omit<SnapshotRecord, 'contentMarkdown' | 'contentJson'>[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('snapshots')
    .select('id, source_id, fetched_at, content_hash, token_count')
    .eq('source_id', sourceId)
    .order('fetched_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    fetchedAt: r.fetched_at,
    contentHash: r.content_hash,
    tokenCount: r.token_count,
  }));
}

// ── Diffs ─────────────────────────────────────────────────────────────────────
export async function storeDiff(
  sourceId: string,
  fromSnapshotId: string | null,
  toSnapshotId: string,
  diff: SemanticDiff
): Promise<DiffRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('diffs')
    .insert({
      source_id: sourceId,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      change_summary: diff.changeSummary,
      added_sections: diff.added,
      removed_sections: diff.removed,
      changed_sections: diff.changed.map(({ heading, id, before, after }) => ({
        heading, id,
        before: before.slice(0, 500), // truncate to keep DB lean
        after: after.slice(0, 500),
      })),
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to store diff: ${error?.message}`);
  return {
    id: data.id,
    sourceId: data.source_id,
    fromSnapshotId: data.from_snapshot_id,
    toSnapshotId: data.to_snapshot_id,
    changeSummary: data.change_summary,
    addedSections: data.added_sections,
    removedSections: data.removed_sections,
    changedSections: data.changed_sections,
    changedAt: data.changed_at,
  };
}

export async function listDiffs(sourceId: string, limit = 20): Promise<DiffRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('diffs')
    .select('*')
    .eq('source_id', sourceId)
    .order('changed_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    fromSnapshotId: r.from_snapshot_id,
    toSnapshotId: r.to_snapshot_id,
    changeSummary: r.change_summary,
    addedSections: r.added_sections,
    removedSections: r.removed_sections,
    changedSections: r.changed_sections,
    changedAt: r.changed_at,
  }));
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
export async function listWebhooks(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('webhooks')
    .select('id, user_id, url, events, active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function createWebhook(
  userId: string,
  url: string,
  events: string[]
): Promise<{ id: string; secret: string }> {
  const { randomBytes } = await import('crypto');
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('webhooks')
    .insert({ user_id: userId, url, events, secret })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to create webhook: ${error?.message}`);
  return { id: data.id, secret };
}

export async function deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId)
    .eq('user_id', userId);
  return !error;
}

export async function getUserWebhooksForEvent(
  userId: string,
  event: string
): Promise<Array<{ id: string; url: string; secret: string }>> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('webhooks')
    .select('id, url, secret')
    .eq('user_id', userId)
    .eq('active', true)
    .contains('events', [event]);
  return (data ?? []).map((r) => ({ id: r.id, url: r.url, secret: r.secret }));
}

// Mark source crawled + schedule next run
export async function markSourceCrawled(sourceId: string, scheduleInterval: number | null) {
  const supabase = getSupabaseAdmin();
  await supabase.rpc('mark_source_crawled', {
    p_source_id: sourceId,
    p_interval: scheduleInterval,
  });
}

// Get sources due for crawling (called by cron dispatcher)
export async function getDueSources(limit = 50): Promise<Source[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.rpc('get_due_sources', { p_limit: limit });
  return (data ?? []).map((r: Record<string, unknown>) => rowToSource(r));
}
