import { createHmac } from 'crypto';
import type { SemanticDiff } from './diff';

export interface WebhookPayload {
  event: string;
  source_id: string;
  url: string;
  change_summary: string;
  diff: {
    added: string[];
    removed: string[];
    changed: string[];
  };
  timestamp: string;
}

export function signPayload(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

export function buildPayload(
  sourceId: string,
  sourceUrl: string,
  diff: SemanticDiff
): WebhookPayload {
  return {
    event: 'source.changed',
    source_id: sourceId,
    url: sourceUrl,
    change_summary: diff.changeSummary,
    diff: {
      added: diff.added.map((s) => s.heading),
      removed: diff.removed.map((s) => s.heading),
      changed: diff.changed.map((s) => s.heading),
    },
    timestamp: new Date().toISOString(),
  };
}

const WEBHOOK_TIMEOUT_MS = 10_000;

export async function deliverWebhook(
  webhookUrl: string,
  secret: string,
  payload: WebhookPayload
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sift-Signature': signature,
        'X-Sift-Event': payload.event,
        'User-Agent': 'Sift-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
