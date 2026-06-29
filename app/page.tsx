'use client';

import { useState } from 'react';
import Link from 'next/link';

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

const FEATURES = [
  {
    title: 'Cleaner than raw Readability',
    body: 'Strips nav, sidebars, cookie banners, ads, and "on this page" TOCs. Tunes for Docusaurus, Sphinx, ReadMe, Mintlify, GitBook, and MkDocs by name.',
  },
  {
    title: 'Scheduled change detection',
    body: 'Register a URL with a schedule. Sift re-crawls it, diffs section-by-section, and fires a webhook only when content meaningfully changed — not on every cosmetic tweak.',
  },
  {
    title: 'Structured for LLMs',
    body: 'Returns heading tree, code blocks with language tags, and tables as typed arrays alongside the Markdown. Stable output = meaningful diffs. Token count on every response.',
  },
];

const TIERS = [
  {
    name: 'Free',
    price: 0,
    features: ['100 extractions / mo', '2 watched sources', 'Daily schedule', 'API access'],
  },
  {
    name: 'Pro',
    price: 19,
    features: ['5,000 extractions / mo', '50 watched sources', 'Hourly schedule', 'Webhooks + full history'],
    highlight: true,
  },
  {
    name: 'Team',
    price: 99,
    features: ['50,000 extractions / mo', '500 watched sources', 'Every 15 min', 'Priority support'],
  },
];

const EXAMPLE = `curl -X POST https://your-domain.com/api/v1/extract \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://docs.example.com/quickstart", "niche": "docs"}'`;

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

      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Sift</span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/docs" className="text-gray-500 hover:text-white transition-colors">API Docs</Link>
          <Link href="/dashboard/sources" className="text-gray-500 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors text-xs font-semibold">
            Sign in →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center space-y-5">
        <div className="inline-block text-xs text-blue-400 border border-blue-800 bg-blue-950/40 px-3 py-1 rounded-full">
          Docs · Changelogs · API References
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">
          URL → clean Markdown for AI
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Extract any webpage into token-efficient Markdown + structured JSON.
          Schedule it, detect what changed, fire a webhook. Built for RAG pipelines and AI agents.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors">
            Start for free →
          </Link>
          <Link href="/docs" className="text-gray-400 hover:text-white text-sm transition-colors px-4 py-2.5">
            Read the docs
          </Link>
        </div>
      </section>

      {/* Code sample */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-xs text-gray-300 overflow-auto">
          {EXAMPLE}
        </pre>
      </section>

      {/* Live playground */}
      <section className="max-w-5xl mx-auto px-6 pb-20 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live demo</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

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
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
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
                  ['URL', result.url], ['Title', result.title],
                  ['Tokens (~cl100k)', result.tokenCount.toLocaleString()],
                  ['Content hash', result.contentHash], ['Render mode', result.renderMode],
                  ['Extraction time', elapsed != null ? `${(elapsed / 1000).toFixed(2)}s` : '—'],
                  ['Sections', String(countOf('sections'))], ['Code blocks', String(countOf('codeBlocks'))],
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
          <div className="text-center py-12 text-gray-700 text-sm">
            Paste any docs URL above — see clean Markdown in seconds.
          </div>
        )}
      </section>

      {/* Features */}
      <section className="border-t border-gray-800 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-2">
                <h3 className="text-white text-sm font-semibold">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-gray-800 py-20">
        <div className="max-w-3xl mx-auto px-6 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-white font-semibold text-lg">Simple pricing</h2>
            <p className="text-gray-500 text-sm">Free to start, no card required. Upgrade when you need more.</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {TIERS.map((t) => (
              <div key={t.name} className={`rounded p-5 space-y-4 border ${t.highlight ? 'border-blue-500 bg-blue-950/20' : 'border-gray-800 bg-gray-900'}`}>
                <div>
                  <div className="text-white font-semibold text-sm">{t.name}</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {t.price === 0 ? 'Free' : `$${t.price}`}
                    {t.price > 0 && <span className="text-sm text-gray-500 font-normal">/mo</span>}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {t.features.map((f) => (
                    <li key={f} className="text-xs text-gray-400 flex gap-2">
                      <span className="text-green-400 shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/login"
                  className={`block text-center text-xs py-2 rounded transition-colors font-semibold ${t.highlight ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-700">
          <span>Sift — URL to clean Markdown for AI</span>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-gray-500 transition-colors">API Docs</Link>
            <Link href="/dashboard/sources" className="hover:text-gray-500 transition-colors">Dashboard</Link>
            <a href="/llms.txt" className="hover:text-gray-500 transition-colors">llms.txt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
