'use client';

import { useState, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiKeyRecord } from '@/lib/keys';
import { timeAgo } from '@/lib/format';
import { createKeyAction, revokeKeyAction } from './actions';

export function KeysClient({ keys: initial }: { keys: ApiKeyRecord[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      const result = await createKeyAction(_prev, fd);
      if ('key' in result) {
        setCreatedKey(result.key);
        startTransition(() => router.refresh());
      }
      return result;
    },
    null
  );

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this key? It will stop working immediately.')) return;
    await revokeKeyAction(keyId);
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <h1 className="text-white font-semibold text-base">API Keys</h1>

      {/* Created key modal */}
      {createdKey && (
        <div className="bg-gray-900 border border-green-800 rounded p-4 space-y-2">
          <p className="text-green-400 text-xs font-semibold">Key created — copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white bg-gray-950 rounded px-3 py-2 break-all">{createdKey}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey); }}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => { setCreatedKey(null); startTransition(() => router.refresh()); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Create form */}
      <form action={formAction} className="flex gap-2">
        <input
          name="name"
          placeholder="Key name (optional)"
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
        >
          {pending ? 'Creating…' : 'Create key'}
        </button>
      </form>
      {'error' in (state ?? {}) && (
        <p className="text-red-400 text-xs">{(state as { error: string }).error}</p>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="text-xs text-gray-600 py-8 text-center">No API keys yet.</div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="bg-gray-900 border border-gray-800 rounded p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{k.name}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <code>{k.keyPrefix}…</code>
                  <span>created {timeAgo(k.createdAt)}</span>
                  {k.lastUsedAt && <span>last used {timeAgo(k.lastUsedAt)}</span>}
                  {!k.lastUsedAt && <span className="text-gray-700">never used</span>}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
      {isPending && <p className="text-xs text-gray-600">Refreshing…</p>}
    </div>
  );
}
