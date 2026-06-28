# Sift

URL → clean Markdown + structured JSON, optimized for LLMs and RAG pipelines.

## What it does

Paste any URL and get:
- **Clean Markdown** stripped of nav, footer, cookie banners, ads, and sidebar noise
- **Structured JSON** — heading tree, code blocks with language tags, tables with typed arrays
- **Token count** estimate (cl100k basis) and a stable content hash for change detection
- **Docs niche tuning** for Docusaurus, Sphinx/RTD, ReadMe, Mintlify, GitBook, and MkDocs
- **Authenticated API** (`/api/v1/extract`) with API key auth and monthly quota enforcement

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Extraction:** `@mozilla/readability` + `jsdom` + `turndown`
- **JS-rendered fallback:** Playwright (Chromium)
- **Database / Auth:** Supabase (Postgres)
- **Tests:** Vitest (60 tests)

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browser
npx playwright install chromium

# 3. Copy env
cp .env.example .env.local

# 4. Start dev server
npm run dev
```

**Playground** (no auth): http://localhost:3000  
**API docs**: http://localhost:3000/docs

## Supabase setup (for authenticated API)

1. Create a free project at https://supabase.com
2. Run `supabase/migrations/001_initial.sql` in the Supabase SQL editor
3. Add credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
4. Create a user in Supabase Auth, get their JWT, then:
   ```bash
   # Create an API key
   curl -X POST http://localhost:3000/api/keys \
     -H "Authorization: Bearer <supabase_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"name": "My key"}'
   # Returns: { "key": "sk_live_...", ... }
   
   # Use the key
   curl -X POST http://localhost:3000/api/v1/extract \
     -H "Authorization: Bearer sk_live_..." \
     -H "Content-Type: application/json" \
     -d '{"url": "https://docs.python.org/3/library/json.html", "niche": "docs"}'
   ```

## Test

```bash
npm test
```

60 tests: extraction quality, boilerplate removal, code blocks, tables, API auth (mocked), quota enforcement, 429 on limit exceeded.

## Public API (`/api/v1/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/extract` | API key | Extract URL |
| GET | `/api/v1/usage` | API key | Check quota |
| GET | `/api/keys` | JWT | List keys |
| POST | `/api/keys` | JWT | Create key |
| DELETE | `/api/keys/:id` | JWT | Revoke key |

Full docs at `/docs`.

**Error shapes:**
- `401` — `{ "error": "...", "code": "INVALID_API_KEY" }`
- `422` — `{ "error": "...", "code": "INVALID_URL" }`
- `429` — `{ "error": "...", "code": "QUOTA_EXCEEDED", "limit": 100, "used": 100, "reset_at": "..." }`
- `502` — `{ "error": "...", "code": "FETCH_ERROR" }`

## Project structure

```
lib/
  extract/         — extraction engine (Phase 1)
  supabase/        — Supabase admin client
  keys.ts          — API key gen/hash/lookup/revoke
  usage.ts         — quota tracking and enforcement
  auth.ts          — request authentication (API key + JWT)

app/
  page.tsx                    — playground UI (no auth)
  docs/page.tsx               — API reference page
  api/extract/route.ts        — POST /api/extract (playground, no auth)
  api/v1/extract/route.ts     — POST /api/v1/extract (authenticated)
  api/v1/usage/route.ts       — GET /api/v1/usage
  api/keys/route.ts           — GET+POST /api/keys
  api/keys/[id]/route.ts      — DELETE /api/keys/:id

supabase/migrations/
  001_initial.sql  — api_keys + usage tables + increment_usage() function

__tests__/
  extract.test.ts  — 43 extraction tests
  auth.test.ts     — 17 auth/quota tests
  fixtures/        — HTML fixtures
```

## Phases

- [x] **Phase 1** — Extraction engine + playground
- [x] **Phase 2** — Public API + auth keys + quota
- [ ] Phase 3 — Scheduling + change detection (the wedge)
- [ ] Phase 4 — Dashboard
- [ ] Phase 5 — Billing (Stripe)
- [ ] Phase 6 — Launch polish
