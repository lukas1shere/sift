-- Phase 2: API keys + usage tracking
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- ── API Keys ────────────────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT 'Default',
  key_hash    TEXT        NOT NULL UNIQUE,
  key_prefix  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX api_keys_hash_idx    ON api_keys(key_hash);
CREATE INDEX api_keys_user_id_idx ON api_keys(user_id) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own keys"
  ON api_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Usage ────────────────────────────────────────────────────────────────────
CREATE TABLE usage (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start       DATE    NOT NULL,
  extractions_count  INTEGER NOT NULL DEFAULT 0,
  tokens_out         BIGINT  NOT NULL DEFAULT 0,
  UNIQUE(user_id, period_start)
);

CREATE INDEX usage_user_period_idx ON usage(user_id, period_start);

ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own usage"
  ON usage FOR SELECT
  USING (auth.uid() = user_id);

-- ── Atomic usage increment (called server-side with service role) ─────────────
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id    UUID,
  p_period     DATE,
  p_tokens     BIGINT
) RETURNS void AS $$
BEGIN
  INSERT INTO usage (user_id, period_start, extractions_count, tokens_out)
  VALUES (p_user_id, p_period, 1, p_tokens)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    extractions_count = usage.extractions_count + 1,
    tokens_out        = usage.tokens_out + p_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
