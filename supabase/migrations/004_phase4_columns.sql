-- ============================================================
-- Phase 4 Migration: Add columns to delivery_sales + ad_campaigns
-- ============================================================

-- delivery_sales: add gross_revenue, commission_rate, cancellation_rate, platform_rating, data_source
ALTER TABLE delivery_sales ADD COLUMN IF NOT EXISTS gross_revenue NUMERIC(12,2);
ALTER TABLE delivery_sales ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);
ALTER TABLE delivery_sales ADD COLUMN IF NOT EXISTS cancellation_rate NUMERIC(5,4);
ALTER TABLE delivery_sales ADD COLUMN IF NOT EXISTS platform_rating NUMERIC(3,2);
ALTER TABLE delivery_sales ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'csv';

-- ad_campaigns: add campaign_id, reach, cpa, data_source
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS reach INTEGER;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS cpa NUMERIC(10,2);
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual';

-- Index for Meta API dedup: (store_id, platform, campaign_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_campaigns_meta_dedup
  ON ad_campaigns (store_id, platform, campaign_id)
  WHERE campaign_id IS NOT NULL;
