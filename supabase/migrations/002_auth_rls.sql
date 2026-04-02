-- Phase 2: Link users to Supabase Auth + Row Level Security

-- Add auth_id column to users table
ALTER TABLE users ADD COLUMN auth_id UUID UNIQUE REFERENCES auth.users(id);

-- ============================================================
-- RLS: Enable on data tables
-- ============================================================

ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_brand_search ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_conversion_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocard_member_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocard_rfm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get current user's store_id (NULL = owner)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Policy: owner sees all, manager sees own store only
-- Applied to all store-scoped data tables
-- ============================================================

-- daily_sales
CREATE POLICY "users_select_daily_sales" ON daily_sales FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_daily_sales" ON daily_sales FOR ALL USING (
  auth.role() = 'service_role'
);

-- hourly_sales
CREATE POLICY "users_select_hourly_sales" ON hourly_sales FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_hourly_sales" ON hourly_sales FOR ALL USING (
  auth.role() = 'service_role'
);

-- product_sales
CREATE POLICY "users_select_product_sales" ON product_sales FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_product_sales" ON product_sales FOR ALL USING (
  auth.role() = 'service_role'
);

-- order_items
CREATE POLICY "users_select_order_items" ON order_items FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_order_items" ON order_items FOR ALL USING (
  auth.role() = 'service_role'
);

-- gsc_brand_search
CREATE POLICY "users_select_gsc" ON gsc_brand_search FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_gsc" ON gsc_brand_search FOR ALL USING (
  auth.role() = 'service_role'
);

-- ga4_events
CREATE POLICY "users_select_ga4" ON ga4_events FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_ga4" ON ga4_events FOR ALL USING (
  auth.role() = 'service_role'
);

-- member_conversion_daily
CREATE POLICY "users_select_conversion" ON member_conversion_daily FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_conversion" ON member_conversion_daily FOR ALL USING (
  auth.role() = 'service_role'
);

-- weather_daily
CREATE POLICY "users_select_weather" ON weather_daily FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_weather" ON weather_daily FOR ALL USING (
  auth.role() = 'service_role'
);

-- campaigns
CREATE POLICY "users_select_campaigns" ON campaigns FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_campaigns" ON campaigns FOR ALL USING (
  auth.role() = 'service_role'
);

-- upload_history
CREATE POLICY "users_select_upload_history" ON upload_history FOR SELECT USING (
  get_user_role() = 'owner' OR store_id IS NULL OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_upload_history" ON upload_history FOR ALL USING (
  auth.role() = 'service_role'
);

-- ocard_member_snapshots
CREATE POLICY "users_select_ocard_members" ON ocard_member_snapshots FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_ocard_members" ON ocard_member_snapshots FOR ALL USING (
  auth.role() = 'service_role'
);

-- ocard_rfm_snapshots
CREATE POLICY "users_select_ocard_rfm" ON ocard_rfm_snapshots FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_ocard_rfm" ON ocard_rfm_snapshots FOR ALL USING (
  auth.role() = 'service_role'
);

-- product_costs
CREATE POLICY "users_select_product_costs" ON product_costs FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_product_costs" ON product_costs FOR ALL USING (
  auth.role() = 'service_role'
);

-- ============================================================
-- Stores table: owner sees all, others see own store
-- ============================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_stores" ON stores FOR SELECT USING (
  get_user_role() = 'owner' OR id = get_user_store_id()
);
CREATE POLICY "service_all_stores" ON stores FOR ALL USING (
  auth.role() = 'service_role'
);
