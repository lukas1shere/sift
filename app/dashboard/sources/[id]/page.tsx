import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { getSource, listDiffs, listSnapshots, getLatestSnapshot } from '@/lib/sources';
import { formatSchedule, timeAgo, timeUntil, shortHash } from '@/lib/format';
import { CrawlNowButton } from './CrawlNowButton';

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [source, diffs, snapshot] = await Promise.all([
    getSource(id, user.id).catch(() => null),
    listDiffs(id, 30).catch(() => []),
    getLatestSnapshot(id).catch(() => null),
  ]);

  if (!source) notFound();

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back + header */}
      <div className="space-y-3">
        <Link href="/dashboard/sources" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Sources
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-white font-semibold text-sm break-all">{source.url}</h1>
            <div className="flex gap-3 text-xs text-gray-500 mt-1">
              <span className={source.active ? 'text-green-400' : 'text-gray-600'}>
                {source.active ? 'active' : 'paused'}
              </span>
              <span>{source.niche}</span>
              <span>{formatSchedule(source.scheduleInterval)}</span>
              {source.lastCrawlAt && <span>crawled {timeAgo(source.lastCrawlAt)}</span>}
              {source.nextCrawlAt && source.active && <span>next {timeUntil(source.nextCrawlAt)}</span>}
            </div>
          </div>
          <CrawlNowButton sourceId={id} />
        </div>
      </div>

      {/* Latest snapshot */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Latest snapshot</h2>
          {snapshot && (
            <span className="text-xs text-gray-600">
              {shortHash(snapshot.contentHash)} · ~{snapshot.tokenCount.toLocaleString()} tokens · {timeAgo(snapshot.fetchedAt)}
            </span>
          )}
        </div>
        {snapshot ? (
          <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-xs text-gray-300 overflow-auto max-h-72 whitespace-pre-wrap break-words">
            {snapshot.contentMarkdown.slice(0, 4000)}
            {snapshot.contentMarkdown.length > 4000 && '\n\n[truncated…]'}
          </pre>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded p-4 text-xs text-gray-600">
            No snapshot yet. Click "Crawl now" to fetch the first one.
          </div>
        )}
      </section>

      {/* Diff history */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Change history ({diffs.length})
        </h2>
        {diffs.length === 0 ? (
          <div className="text-xs text-gray-600 py-4">
            No changes detected yet. Changes appear here when content differs between crawls.
          </div>
        ) : (
          <div className="space-y-2">
            {diffs.map((diff) => (
              <div key={diff.id} className="bg-gray-900 border border-gray-800 rounded p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-white">{diff.changeSummary}</p>
                  <span className="text-xs text-gray-600 shrink-0">{timeAgo(diff.changedAt)}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  {(diff.addedSections as string[]).length > 0 && (
                    <span className="text-green-400">+{(diff.addedSections as string[]).length} added</span>
                  )}
                  {(diff.removedSections as string[]).length > 0 && (
                    <span className="text-red-400">-{(diff.removedSections as string[]).length} removed</span>
                  )}
                  {(diff.changedSections as string[]).length > 0 && (
                    <span className="text-yellow-400">~{(diff.changedSections as string[]).length} changed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
