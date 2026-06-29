# Sift — Claude Code Context

## What this is

A SaaS product: URL → clean Markdown + structured JSON for AI/RAG pipelines.
Wedge: **scheduled change detection** — crawl a URL on a schedule, diff against
the previous snapshot, fire a webhook only when content meaningfully changed.
Launch niche: documentation sites (Docusaurus, Sphinx, Mintlify, ReadMe, GitBook).

## Build status

| Phase | Status | What it covers |
|-------|--------|----------------|
| 1 — Extraction engine | ✅ Done | extract(), playground at /, 43 tests |
| 2 — Public API + auth | ✅ Done | /api/v1/extract, API keys, quota, 17 tests |
| 3 — Scheduling + diff | ✅ Done | Sources, snapshots, semantic diff, Inngest, webhooks, 20 tests |
| 4 — Dashboard | 🔜 Next | Auth'd UI: manage sources, view diffs, API keys, usage |
| 5 — Billing | 🔜 | Stripe Checkout, tier enforcement |
| 6 — Launch polish | 🔜 | Landing page, OpenAPI spec, deploy |

**80 tests pass.** Run with `npm test`.

## Stack decisions (already made — don't change without asking)

- **Framework:** Next.js 16, App Router, TypeScript
- **Extraction:** @mozilla/readability + jsdom + turndown + Playwright fallback
- **Jobs/scheduling:** Inngest v4 (NOT BullMQ/Redis) — functions in `inngest/`
- **Database/auth:** Supabase (Postgres + Auth)
- **Billing:** Stripe (Phase 5, not wired yet)
- **Deploy:** Vercel (app) — no separate worker needed because of Inngest

## Key files

```
lib/extract/index.ts          Main extract() function
lib/extract/clean.ts          Boilerplate removal + framework detection
lib/extract/markdown.ts       HTML → normalized Markdown (Turndown + custom rules)
lib/extract/structure.ts      Markdown → JSON (sections/codeBlocks/tables)
lib/extract/niche/docs.ts     Docs-site-specific DOM cleanup
lib/diff.ts                   Semantic diff engine (section tree comparison)
lib/sources.ts                Source/snapshot/diff/webhook CRUD (Supabase)
lib/webhook.ts                HMAC-signed webhook delivery
lib/keys.ts                   API key generation (sk_live_...), SHA-256 hashing
lib/usage.ts                  Monthly quota tracking
lib/auth.ts                   Request auth (API key + Supabase JWT)
lib/supabase/client.ts        Supabase admin client singleton
inngest/client.ts             Inngest client (v4)
inngest/functions.ts          crawlSource, dispatchDueSources, deliverWebhooks
app/page.tsx                  Playground (no auth, paste URL → see output)
app/docs/page.tsx             API reference page
app/api/extract/route.ts      Internal playground endpoint (no auth)
app/api/v1/extract/route.ts   Public API endpoint (requires API key)
app/api/v1/sources/...        Source CRUD + manual crawl trigger
app/api/v1/webhooks/...       Webhook CRUD
app/api/inngest/route.ts      Inngest callback handler
supabase/migrations/          001_initial.sql (keys+usage), 002_scheduling.sql
```

## Run locally

```bash
npm install
npx playwright install chromium
cp .env.example .env.local   # fill in Supabase creds for auth features
npm run dev                  # http://localhost:3000
npm test                     # 80 tests
```

For scheduled jobs locally:
```bash
npx inngest-cli@latest dev   # http://localhost:8288
```

## Supabase setup

Run both migrations in order in the Supabase SQL editor:
1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_scheduling.sql`

## Phase 4 — Dashboard (what to build next)

Auth'd Next.js UI using Supabase Auth (magic link or OAuth):
- **Sources page:** list/create/pause sources, show last crawl time + status
- **Diff history:** per-source timeline of changes with changeSummary + before/after sections
- **Snapshot viewer:** latest extracted markdown for a source
- **API keys page:** list/create/revoke keys (name, prefix, last used)
- **Webhooks page:** list/create/delete webhook endpoints
- **Usage widget:** extractions used / limit / reset date (visible everywhere)

Use Supabase Auth `@supabase/ssr` package for cookie-based sessions in Next.js App Router.
Keep UI minimal and fast — dark theme matching the playground already built.

## Tier limits (config-driven via env vars)

```
TIER_FREE_EXTRACTIONS_PER_MONTH=100
TIER_FREE_SOURCES=2
TIER_FREE_MIN_SCHEDULE_INTERVAL=86400   # daily
TIER_PRO_EXTRACTIONS_PER_MONTH=5000
TIER_PRO_SOURCES=50
TIER_PRO_MIN_SCHEDULE_INTERVAL=3600    # hourly
TIER_TEAM_EXTRACTIONS_PER_MONTH=50000
TIER_TEAM_SOURCES=500
TIER_TEAM_MIN_SCHEDULE_INTERVAL=900    # 15 min
```

Phase 5 will read the user's tier from a subscriptions table and enforce these per-user.
For now everyone gets the free tier limits.

## Important constraints

- Extraction quality is the whole product — don't regress it
- Diffs must be semantic (section-level), not raw text — cosmetic changes must not fire webhooks
- Secrets in env vars only — never committed
- No microservices, no premature abstraction — smallest thing that works
- `npm test` must stay green before every commit
