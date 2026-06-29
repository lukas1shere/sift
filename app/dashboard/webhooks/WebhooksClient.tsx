'use client';

import { useState, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { timeAgo, truncate } from '@/lib/format';
import { createWebhookAction, deleteWebhookAction } from './actions';

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export function WebhooksClient({ webhooks: initial }: { webhooks: WebhookRow[] }) {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState(initial);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      const result = await createWebhookAction(_prev, fd);
      if ('secret' in result) {
        setCreatedSecret(result.secret);
        startTransition(() => router.refresh());
      }
      return result;
    },
    null
  );

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook?')) return;
    await deleteWebhookAction(id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <h1 className="text-white font-semibold text-base">Webhooks</h1>

      {/* Secret reveal */}
      {createdSecret && (
        <div className="bg-gray-900 border border-green-800 rounded p-4 space-y-2">
          <p className="text-green-400 text-xs font-semibold">Webhook created — save your signing secret now</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white bg-gray-950 rounded px-3 py-2 break-all">{createdSecret}</code>
            <button
              onClick={() => navigator.clipboard.writeText(createdSecret)}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Verify payloads: <code>X-Sift-Signature: sha256=HMAC(body, secret)</code>
          </p>
          <button
            onClick={() => { setCreatedSecret(null); startTransition(() => router.refresh()); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Create form */}
      <form action={formAction} className="flex gap-2">
        <input
          name="url"
          type="url"
          required
          placeholder="https://yourapp.com/webhooks/sift"
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
        >
          {pending ? 'Adding…' : 'Add webhook'}
        </button>
      </form>
      {'error' in (state ?? {}) && (
        <p className="text-red-400 text-xs">{(state as { error: string }).error}</p>
      )}
      <p className="text-xs text-gray-600">All webhooks receive the <code>source.changed</code> event.</p>

      {/* Webhook list */}
      {webhooks.length === 0 ? (
        <div className="text-xs text-gray-600 py-8 text-center">No webhooks yet.</div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((w) => (
            <div key={w.id} className="bg-gray-900 border border-gray-800 rounded p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm text-white truncate">{truncate(w.url, 60)}</p>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{w.events.join(', ')}</span>
                  <span>added {timeAgo(w.created_at)}</span>
                  <span className={w.active ? 'text-green-400' : 'text-gray-600'}>{w.active ? 'active' : 'disabled'}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(w.id)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      {isPending && <p className="text-xs text-gray-600">Refreshing…</p>}
    </div>
  );
}
