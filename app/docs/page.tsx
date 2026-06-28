export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-lg font-bold text-white">Sift</a>
        <span className="text-gray-500 text-sm">API Reference</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        <section>
          <h1 className="text-2xl font-bold text-white mb-2">Sift API</h1>
          <p className="text-gray-400 text-sm">
            Base URL: <code className="text-blue-400">https://your-deployment.vercel.app/api/v1</code>
          </p>
        </section>

        {/* Auth */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Authentication</h2>
          <p className="text-gray-400 text-sm">Pass your API key in the <code className="text-blue-300">Authorization</code> header on every request.</p>
          <Pre>{`curl -X POST /api/v1/extract \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://docs.example.com/page"}'`}</Pre>
        </section>

        {/* Extract */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">POST /api/v1/extract</h2>
            <p className="text-gray-400 text-sm mt-2">Extract clean Markdown and structured JSON from a URL.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Request body</h3>
            <Table headers={['Parameter', 'Type', 'Required', 'Description']} rows={[
              ['url', 'string', 'Yes', 'The URL to extract. Must be http or https.'],
              ['niche', '"docs" | "auto"', 'No', 'Extraction preset. "docs" tunes for documentation sites. Default: "auto"'],
              ['render_mode', '"fetch" | "playwright" | "auto"', 'No', 'How to fetch the page. "auto" tries fetch first and falls back to Playwright. Default: "auto"'],
            ]} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Response</h3>
            <Pre>{`{
  "url": "https://docs.example.com/page",
  "title": "Page Title",
  "description": "Meta description if present",
  "markdown": "# Page Title\\n\\nClean content...",
  "json": {
    "title": "Page Title",
    "sections": [
      { "id": "overview", "level": 1, "heading": "Overview",
        "content": "...", "children": [] }
    ],
    "codeBlocks": [{ "language": "python", "code": "print('hi')" }],
    "tables": [{ "headers": ["Param", "Type"], "rows": [["x", "string"]] }]
  },
  "content_hash": "sha256hexhash",
  "token_count": 1234,
  "render_mode": "fetch",
  "meta": { "author": "...", "publishedAt": "..." },
  "_quota": { "used": 1, "limit": 100, "reset_at": "2024-02-01T00:00:00.000Z" }
}`}</Pre>
          </div>
        </section>

        {/* Usage */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">GET /api/v1/usage</h2>
          <p className="text-gray-400 text-sm">Check your current quota usage for the billing period.</p>
          <Pre>{`{
  "extractions": { "used": 42, "limit": 100, "remaining": 58 },
  "reset_at": "2024-02-01T00:00:00.000Z"
}`}</Pre>
        </section>

        {/* Error codes */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Error codes</h2>
          <Table headers={['HTTP', 'code', 'When']} rows={[
            ['401', 'INVALID_API_KEY', 'Missing or invalid API key'],
            ['400', 'BAD_REQUEST', 'Malformed JSON body'],
            ['422', 'INVALID_URL', 'url missing or not a valid http/https URL'],
            ['429', 'QUOTA_EXCEEDED', 'Monthly extraction limit reached. Check reset_at.'],
            ['404', 'FETCH_ERROR', 'Target URL returned 404'],
            ['502', 'FETCH_ERROR', 'Could not reach the target URL'],
            ['503', 'DB_ERROR', 'Database temporarily unavailable'],
            ['500', 'INTERNAL_ERROR', 'Unexpected server error'],
          ]} />
          <p className="text-gray-500 text-xs">All errors return <code>{`{ "error": "message", "code": "CODE" }`}</code>. 429 also includes <code>limit</code>, <code>used</code>, and <code>reset_at</code>.</p>
        </section>

        {/* Rate limits */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Tiers &amp; limits</h2>
          <Table headers={['Tier', 'Extractions/month', 'Watched sources', 'Schedule']} rows={[
            ['Free', '100', '2', 'Daily max'],
            ['Pro (~$19/mo)', '5,000', '50', 'Hourly'],
            ['Team (~$99/mo)', '50,000', '500', 'Every 15 min'],
          ]} />
        </section>
      </main>
    </div>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-xs text-gray-200 overflow-auto whitespace-pre">
      {children}
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-800">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 pr-6 text-gray-400 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-900">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-6 text-gray-300 align-top">
                  <code className="text-xs">{cell}</code>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
