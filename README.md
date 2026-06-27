# Sift

URL → clean Markdown + structured JSON, optimized for LLMs and RAG pipelines.

## What it does

Paste any URL and get:
- **Clean Markdown** stripped of nav, footer, cookie banners, ads, and sidebar noise
- **Structured JSON** — heading tree, code blocks with language tags, tables with typed arrays
- **Token count** estimate (cl100k basis) and a stable content hash for change detection
- **Docs niche tuning** for Docusaurus, Sphinx/RTD, ReadMe, Mintlify, GitBook, and MkDocs

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Extraction:** `@mozilla/readability` + `jsdom` + `turndown`
- **JS-rendered fallback:** Playwright (Chromium)
- **Tests:** Vitest

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browser
npx playwright install chromium

# 3. Copy env (no vars needed for Phase 1)
cp .env.example .env.local

# 4. Start dev server
npm run dev
```

Open http://localhost:3000 — paste any docs URL and hit Extract.

## Test

```bash
npm test
```

43 tests covering boilerplate removal, docs-niche tuning, code block preservation (all languages), table extraction, structure parsing, and output stability.

## API (Phase 1 — playground only, no auth yet)

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.python.org/3/library/json.html", "niche": "docs"}'
```

Response shape:
```json
{
  "url": "...",
  "title": "...",
  "description": "...",
  "markdown": "# ...",
  "json": {
    "title": "...",
    "sections": [{ "id": "...", "level": 1, "heading": "...", "content": "...", "children": [] }],
    "codeBlocks": [{ "language": "python", "code": "..." }],
    "tables": [{ "headers": ["Param", "Type"], "rows": [["x", "string"]] }]
  },
  "contentHash": "sha256hex",
  "tokenCount": 8504,
  "renderMode": "fetch",
  "meta": { "description": "...", "author": "..." }
}
```

## Project structure

```
lib/extract/
  index.ts        — main extract() orchestrator
  clean.ts        — DOM boilerplate removal + main-content targeting
  markdown.ts     — HTML → normalized Markdown (Turndown + custom rules)
  structure.ts    — Markdown → JSON structure (sections, code blocks, tables)
  fetch.ts        — plain HTTP fetch with timeout
  playwright.ts   — Playwright fallback for JS-rendered pages
  niche/docs.ts   — docs-site-specific DOM cleanup
  utils.ts        — sha256, token estimation

app/
  page.tsx              — playground UI
  api/extract/route.ts  — POST /api/extract

__tests__/
  extract.test.ts   — 43 tests
  fixtures/         — 7 saved HTML pages (Docusaurus, Sphinx, ReadMe, etc.)
```

## Phases

- [x] **Phase 1** — Extraction engine + playground
- [ ] Phase 2 — Public API + auth keys + quota
- [ ] Phase 3 — Scheduling + change detection (the wedge)
- [ ] Phase 4 — Dashboard
- [ ] Phase 5 — Billing (Stripe)
- [ ] Phase 6 — Launch polish
