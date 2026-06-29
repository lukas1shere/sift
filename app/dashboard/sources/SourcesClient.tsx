'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Source } from '@/lib/sources';
import { formatSchedule, timeAgo, timeUntil, truncate } from '@/lib/format';
import { createSourceAction, toggleSourceAction, deleteSourceAction } from './actions';

const SCHEDULES = [
  { label: 'One-time', value: '' },
  { label: 'Daily', value: '86400' },
  { label: 'Hourly', value: '3600' },
  { label: 'Every 15 min', value: '900' },
];

export function SourcesClient({ sources: initial }: { sources: Source[] }) {
  const router = useRouter();
  const [sources, setSources] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await createSourceAction(fd);
    setShowForm(false);
    refresh();
  }

  async function handleToggle(source: Source) {
    await toggleSourceAction(source.id, !source.active);
    setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, active: !s.active } : s));
  }

  async function handleDelete(sourceId: string) {
    if (!confirm('Delete this source and all its snapshots?')) return;
    await deleteSourceAction(sourceId);
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-white font-semibold text-base">Sources</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded transition-colors"
        >
          {showForm ? 'Cancel' : '+ Watch URL'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-400">URL</label>
            <input
              name="url"
              type="url"
              required
              placeholder="https://docs.example.com/page"
              className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="space-y-2 flex-1">
              <label className="text-xs text-gray-400">Niche</label>
              <select name="niche" className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="docs">docs</option>
                <option value="auto">auto</option>
              </select>
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs text-gray-400">Schedule</label>
              <select name="schedule_interval" className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {SCHEDULES.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded transition-colors"
          >
            Add source
          </button>
        </form>
      )}

      {/* Source list */}
      {sources.length === 0 ? (
        <div className="text-center py-20 text-gray-700 text-sm">
          No sources yet. Watch a URL to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-0.5">
                <Link
                  href={`/dashboard/sources/${s.id}`}
                  className="text-sm text-white hover:text-blue-400 transition-colors block truncate"
                >
                  {truncate(s.url, 70)}
                </Link>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className={s.active ? 'text-green-400' : 'text-gray-600'}>
                    {s.active ? 'active' : 'paused'}
                  </span>
                  <span>{s.niche}</span>
                  <span>{formatSchedule(s.scheduleInterval)}</span>
                  {s.lastCrawlAt && <span>crawled {timeAgo(s.lastCrawlAt)}</span>}
                  {s.nextCrawlAt && s.active && <span>next {timeUntil(s.nextCrawlAt)}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(s)}
                  className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
                >
                  {s.active ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isPending && <p className="text-xs text-gray-600">Refreshing…</p>}
    </div>
  );
}
