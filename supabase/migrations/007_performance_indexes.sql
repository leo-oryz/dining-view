-- Phase 6: Performance indexes for new query patterns
-- Note: Core indexes on daily_sales, hourly_sales, product_sales, order_items
-- already exist from 001_initial_schema.sql. These are additional indexes
-- for Phase 6 query patterns.

-- Expansion page: hourly avg by hour (group by hour)
CREATE INDEX IF NOT EXISTS idx_hourly_sales_store_hour ON hourly_sales(store_id, hour);

-- Export: order_items by date range with order_number for grouping
CREATE INDEX IF NOT EXISTS idx_order_items_date_order ON order_items(store_id, date, order_number);

-- Member snapshots: demographic queries (age/gender breakdowns)
CREATE INDEX IF NOT EXISTS idx_ocard_members_date_range ON ocard_member_snapshots(store_id, snapshot_date DESC);

-- Weekly digest: recent alerts lookup
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_store_created ON anomaly_alerts(store_id, created_at DESC);
