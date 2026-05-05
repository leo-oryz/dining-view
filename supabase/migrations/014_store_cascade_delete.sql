-- Change all store_id foreign keys to ON DELETE CASCADE
-- so deleting a store automatically removes all related data

-- users: set null (keep user account, just unlink store)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_store_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- All data tables: cascade delete
ALTER TABLE daily_sales DROP CONSTRAINT IF EXISTS daily_sales_store_id_fkey;
ALTER TABLE daily_sales ADD CONSTRAINT daily_sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE hourly_sales DROP CONSTRAINT IF EXISTS hourly_sales_store_id_fkey;
ALTER TABLE hourly_sales ADD CONSTRAINT hourly_sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE product_sales DROP CONSTRAINT IF EXISTS product_sales_store_id_fkey;
ALTER TABLE product_sales ADD CONSTRAINT product_sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_store_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE product_costs DROP CONSTRAINT IF EXISTS product_costs_store_id_fkey;
ALTER TABLE product_costs ADD CONSTRAINT product_costs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_store_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE upload_history DROP CONSTRAINT IF EXISTS upload_history_store_id_fkey;
ALTER TABLE upload_history ADD CONSTRAINT upload_history_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE gsc_brand_search DROP CONSTRAINT IF EXISTS gsc_brand_search_store_id_fkey;
ALTER TABLE gsc_brand_search ADD CONSTRAINT gsc_brand_search_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE ga4_events DROP CONSTRAINT IF EXISTS ga4_events_store_id_fkey;
ALTER TABLE ga4_events ADD CONSTRAINT ga4_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE member_conversion_daily DROP CONSTRAINT IF EXISTS member_conversion_daily_store_id_fkey;
ALTER TABLE member_conversion_daily ADD CONSTRAINT member_conversion_daily_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE weather_daily DROP CONSTRAINT IF EXISTS weather_daily_store_id_fkey;
ALTER TABLE weather_daily ADD CONSTRAINT weather_daily_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE competitor_events DROP CONSTRAINT IF EXISTS competitor_events_store_id_fkey;
ALTER TABLE competitor_events ADD CONSTRAINT competitor_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_store_id_fkey;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE ai_analysis_reports DROP CONSTRAINT IF EXISTS ai_analysis_reports_store_id_fkey;
ALTER TABLE ai_analysis_reports ADD CONSTRAINT ai_analysis_reports_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE anomaly_alerts DROP CONSTRAINT IF EXISTS anomaly_alerts_store_id_fkey;
ALTER TABLE anomaly_alerts ADD CONSTRAINT anomaly_alerts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE line_broadcasts DROP CONSTRAINT IF EXISTS line_broadcasts_store_id_fkey;
ALTER TABLE line_broadcasts ADD CONSTRAINT line_broadcasts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE store_monthly_targets DROP CONSTRAINT IF EXISTS store_monthly_targets_store_id_fkey;
ALTER TABLE store_monthly_targets ADD CONSTRAINT store_monthly_targets_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- google_reviews and google_review_snapshots already have ON DELETE CASCADE
