'use client';

import { useState } from 'react';

type Tab = 'markdown' | 'json' | 'stats';

interface ExtractResult {
  title: string;
  description?: string;
  url: string;
  markdown: string;
  json: Record<string, unknown>;
  contentHash: string;
  tokenCount: number;
  renderMode: 'fetch' | 'playwright';
  meta: Record<string, string>;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [niche, setNiche] = useState('docs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [tab, setTab] = useState<Tab>('markdown');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), niche, render_mode: 'auto' }),
      });
      const data = await res.json();
      setElapsed(Date.now() - t0);
      if (!res.ok) { setError(data.error ?? `HTTP ${res.status}`); return; }
      setResult(data as ExtractResult);
      setTab('markdown');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setElapsed(Date.now() - t0);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const tabContent = (): string => {
    if (!result) return '';
    if (tab === 'markdown') return result.markdown;
    if (tab === 'json') return JSON.stringify(result.json, null, 2);
    return '';
  };

  const countOf = (key: string): number => {
    const v = result?.json?.[key];
    return Array.isArray(v) ? v.length : 0;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <span className="text-lg font-bold text-white">Sift</span>
        <span className="text-gray-500 text-sm">URL → clean Markdown + JSON for AI</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <form onSubmit={handleExtract} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com/some-page"
            required
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="docs">docs</option>
            <option value="auto">auto</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded font-semibold transition-colors"
          >
            {loading ? 'Extracting…' : 'Extract'}
          </button>
        </form>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-white font-semibold">{result.title}</h2>
                {result.description && <p className="text-gray-500 text-xs mt-0.5">{result.description}</p>}
              </div>
              <div className="flex gap-4 text-xs text-gray-500 shrink-0 mt-1">
                <span>~{result.tokenCount.toLocaleString()} tokens</span>
                {elapsed != null && <span>{(elapsed / 1000).toFixed(1)}s</span>}
                <span className={result.renderMode === 'playwright' ? 'text-amber-400' : 'text-green-400'}>
                  {result.renderMode}
                </span>
                <span className="text-gray-600">{result.contentHash.slice(0, 8)}</span>
              </div>
            </div>

            <div className="flex gap-0 border-b border-gray-800">
              {(['markdown', 'json', 'stats'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                    tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
              <div className="flex-1" />
              {tab !== 'stats' && (
                <button onClick={() => copy(tabContent())} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300">
                  {copied ? 'copied!' : 'copy'}
                </button>
              )}
            </div>

            {tab === 'stats' ? (
              <div className="bg-gray-900 rounded border border-gray-800 p-4 text-sm space-y-2">
                {([
                  ['URL', result.url],
                  ['Title', result.title],
                  ['Tokens (~cl100k)', result.tokenCount.toLocaleString()],
                  ['Content hash', result.contentHash],
                  ['Render mode', result.renderMode],
                  ['Extraction time', elapsed != null ? `${(elapsed / 1000).toFixed(2)}s` : '—'],
                  ['Sections', String(countOf('sections'))],
                  ['Code blocks', String(countOf('codeBlocks'))],
                  ['Tables', String(countOf('tables'))],
                  ...Object.entries(result.meta).map(([k, v]) => [`meta.${k}`, v]),
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex gap-4">
                    <span className="text-gray-500 w-40 shrink-0">{label}</span>
                    <span className="text-gray-200 break-all">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="bg-gray-900 rounded border border-gray-800 p-4 text-xs text-gray-200 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words">
                {tabContent()}
              </pre>
            )}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-20 text-gray-700 text-sm space-y-1">
            <div>Paste any URL — docs, changelogs, API references.</div>
            <div>Returns clean Markdown + structured JSON, stripped of nav and chrome.</div>
          </div>
        )}
      </main>
    </div>
  );
}
