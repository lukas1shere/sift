'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crawlNowAction } from '../actions';

export function CrawlNowButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCrawl() {
    setLoading(true);
    setResult(null);
    try {
      const r = await crawlNowAction(sourceId);
      setResult(r.snapshotId
        ? (r.hasChanges ? `Changed: ${r.changeSummary}` : 'No changes')
        : 'Queued'
      );
      router.refresh();
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : 'Failed'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {result && <span className="text-xs text-gray-500">{result}</span>}
      <button
        onClick={handleCrawl}
        disabled={loading}
        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"
      >
        {loading ? 'Crawling…' : 'Crawl now'}
      </button>
    </div>
  );
}
