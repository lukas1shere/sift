import { inngest } from './client';
import { extract } from '@/lib/extract';
import { diffMarkdown } from '@/lib/diff';
import {
  getSourceById,
  storeSnapshot,
  getLatestSnapshot,
  storeDiff,
  markSourceCrawled,
  getDueSources,
  getUserWebhooksForEvent,
} from '@/lib/sources';
import { buildPayload, deliverWebhook } from '@/lib/webhook';

// ── Crawl a single source ─────────────────────────────────────────────────────
export const crawlSource = inngest.createFunction(
  {
    id: 'crawl-source',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: 'sift/source.crawl' }],
  },
  async ({ event, step }) => {
    const { sourceId } = event.data as { sourceId: string };

    // 1. Get source config
    const source = await step.run('get-source', () => getSourceById(sourceId));
    if (!source || !source.active) return { skipped: true, reason: 'source inactive or missing' };

    // 2. Extract content
    let result;
    try {
      result = await step.run('extract', () =>
        extract(source.url, { niche: source.niche as 'docs' | 'auto', renderMode: source.renderMode as 'fetch' | 'playwright' | 'auto' })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await step.run('mark-crawled-error', () =>
        markSourceCrawled(sourceId, source.scheduleInterval)
      );
      return { error: msg };
    }

    // 3. Store new snapshot
    const newSnapshot = await step.run('store-snapshot', () =>
      storeSnapshot(sourceId, result)
    );

    // 4. Get previous snapshot for comparison
    const prevSnapshot = await step.run('get-prev-snapshot', () =>
      getLatestSnapshot(sourceId, newSnapshot.id)
    );

    // 5. Compute diff
    let hasChanges = false;
    if (prevSnapshot) {
      const diff = diffMarkdown(prevSnapshot.contentMarkdown, result.markdown);

      if (diff.hasChanges) {
        hasChanges = true;

        // 6. Persist the diff record
        await step.run('store-diff', () =>
          storeDiff(sourceId, prevSnapshot.id, newSnapshot.id, diff)
        );

        // 7. Fire webhook event (Inngest retries delivery separately)
        await step.sendEvent('fire-changed-event', {
          name: 'sift/source.changed',
          data: {
            sourceId,
            userId: source.userId,
            sourceUrl: source.url,
            changeSummary: diff.changeSummary,
            diff: {
              added: diff.added.map((s) => s.heading),
              removed: diff.removed.map((s) => s.heading),
              changed: diff.changed.map((s) => s.heading),
            },
          },
        });
      }
    }

    // 8. Update next_crawl_at
    await step.run('mark-crawled', () =>
      markSourceCrawled(sourceId, source.scheduleInterval)
    );

    return {
      sourceId,
      snapshotId: newSnapshot.id,
      contentHash: result.contentHash,
      tokenCount: result.tokenCount,
      hasChanges,
      prevSnapshotId: prevSnapshot?.id ?? null,
    };
  }
);

// ── Dispatch due sources (cron every 5 min) ───────────────────────────────────
export const dispatchDueSources = inngest.createFunction(
  { id: 'dispatch-due-sources', triggers: [{ cron: '*/5 * * * *' }] },
  async ({ step }) => {
    const dueSources = await step.run('get-due-sources', () => getDueSources(50));

    if (dueSources.length === 0) return { dispatched: 0 };

    await step.sendEvent(
      'dispatch-crawls',
      dueSources.map((s) => ({ name: 'sift/source.crawl' as const, data: { sourceId: s.id } }))
    );

    return { dispatched: dueSources.length, sourceIds: dueSources.map((s) => s.id) };
  }
);

// ── Deliver webhooks when a source changes ────────────────────────────────────
export const deliverWebhooks = inngest.createFunction(
  {
    id: 'deliver-webhooks',
    retries: 5,
    triggers: [{ event: 'sift/source.changed' }],
  },
  async ({ event, step }) => {
    const { sourceId, userId, sourceUrl, changeSummary, diff } = event.data as {
      sourceId: string;
      userId: string;
      sourceUrl: string;
      changeSummary: string;
      diff: { added: string[]; removed: string[]; changed: string[] };
    };

    const webhooks = await step.run('get-webhooks', () =>
      getUserWebhooksForEvent(userId, 'source.changed')
    );

    if (webhooks.length === 0) return { delivered: 0 };

    // Reconstruct a minimal SemanticDiff for buildPayload
    const semanticDiff = {
      hasChanges: true,
      added: diff.added.map((h) => ({ heading: h, id: h })),
      removed: diff.removed.map((h) => ({ heading: h, id: h })),
      changed: diff.changed.map((h) => ({ heading: h, id: h, before: '', after: '' })),
      changeSummary,
    };

    const payload = buildPayload(sourceId, sourceUrl, semanticDiff);

    const results = await Promise.allSettled(
      webhooks.map((wh) =>
        step.run(`deliver-${wh.id}`, () => deliverWebhook(wh.url, wh.secret, payload))
      )
    );

    const delivered = results.filter((r) => r.status === 'fulfilled' && (r.value as { ok: boolean }).ok).length;
    return { delivered, total: webhooks.length };
  }
);
