-- Phase 3: Sources, snapshots, diffs, webhooks
-- Run in Supabase SQL editor AFTER 001_initial.sql

-- ── Sources ──────────────────────────────────────────────────────────────────
CREATE TABLE sources (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url               TEXT        NOT NULL,
  niche             TEXT        NOT NULL DEFAULT 'auto',
  render_mode       TEXT        NOT NULL DEFAULT 'auto',
  schedule_interval INTEGER,                 -- seconds between crawls, NULL = one-off
  next_crawl_at     TIMESTAMPTZ,             -- NULL until first schedule is set
  last_crawl_at     TIMESTAMPTZ,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sources_user_id_idx    ON sources(user_id) WHERE active = true;
CREATE INDEX sources_next_crawl_idx ON sources(next_crawl_at) WHERE active = true AND next_crawl_at IS NOT NULL;

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own sources"
  ON sources FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Snapshots ────────────────────────────────────────────────────────────────
CREATE TABLE snapshots (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        UUID        NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_markdown TEXT        NOT NULL,
  content_json     JSONB,
  content_hash     TEXT        NOT NULL,
  token_count      INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX snapshots_source_fetched_idx ON snapshots(source_id, fetched_at DESC);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own snapshots"
  ON snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sources WHERE sources.id = snapshots.source_id AND sources.user_id = auth.uid()
    )
  );

-- ── Diffs ────────────────────────────────────────────────────────────────────
CREATE TABLE diffs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        UUID        NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  from_snapshot_id UUID        REFERENCES snapshots(id),
  to_snapshot_id   UUID        NOT NULL REFERENCES snapshots(id),
  change_summary   TEXT        NOT NULL,
  added_sections   JSONB       DEFAULT '[]',
  removed_sections JSONB       DEFAULT '[]',
  changed_sections JSONB       DEFAULT '[]',
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX diffs_source_changed_idx ON diffs(source_id, changed_at DESC);

ALTER TABLE diffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own diffs"
  ON diffs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sources WHERE sources.id = diffs.source_id AND sources.user_id = auth.uid()
    )
  );

-- ── Webhooks ─────────────────────────────────────────────────────────────────
CREATE TABLE webhooks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  secret     TEXT        NOT NULL,
  events     TEXT[]      NOT NULL DEFAULT '{source.changed}',
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhooks_user_id_idx ON webhooks(user_id) WHERE active = true;

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own webhooks"
  ON webhooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Helper: claim sources due for crawling ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_due_sources(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(id UUID, user_id UUID, url TEXT, niche TEXT, render_mode TEXT, schedule_interval INTEGER)
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.user_id, s.url, s.niche, s.render_mode, s.schedule_interval
  FROM sources s
  WHERE s.active = true
    AND s.next_crawl_at IS NOT NULL
    AND s.next_crawl_at <= now()
  ORDER BY s.next_crawl_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Helper: mark a source as crawled and schedule next run ───────────────────
CREATE OR REPLACE FUNCTION mark_source_crawled(p_source_id UUID, p_interval INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE sources SET
    last_crawl_at = now(),
    next_crawl_at = CASE
      WHEN p_interval IS NOT NULL THEN now() + (p_interval || ' seconds')::INTERVAL
      ELSE NULL  -- one-off: disable scheduling after first crawl
    END
  WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
