-- Phase 5: Stripe subscriptions
-- Run in Supabase SQL editor AFTER 002_scheduling.sql

CREATE TABLE subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  tier                   TEXT        NOT NULL DEFAULT 'free',  -- free | pro | team
  status                 TEXT        NOT NULL DEFAULT 'active', -- active | canceled | past_due | trialing
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_id_idx        ON subscriptions(user_id);
CREATE INDEX subscriptions_customer_id_idx    ON subscriptions(stripe_customer_id);
CREATE INDEX subscriptions_subscription_id_idx ON subscriptions(stripe_subscription_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
