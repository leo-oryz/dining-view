-- Fix: idx_ad_campaigns_meta_dedup was missing `date`, causing conflicts
-- when the same campaign spans multiple days.
DROP INDEX IF EXISTS idx_ad_campaigns_meta_dedup;

CREATE UNIQUE INDEX idx_ad_campaigns_meta_dedup
  ON ad_campaigns (store_id, date, platform, campaign_id)
  WHERE campaign_id IS NOT NULL;
