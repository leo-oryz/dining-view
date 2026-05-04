-- Fix: idx_ad_campaigns_meta_dedup was missing `date`, causing conflicts
-- when the same campaign spans multiple days. Also adds the campaign_id
-- column (referenced by lib/ads/metaClient.ts and tiktokClient.ts) which
-- a missing earlier migration never created.

ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS campaign_id TEXT;

DROP INDEX IF EXISTS idx_ad_campaigns_meta_dedup;

CREATE UNIQUE INDEX idx_ad_campaigns_meta_dedup
  ON ad_campaigns (store_id, date, platform, campaign_id)
  WHERE campaign_id IS NOT NULL;
