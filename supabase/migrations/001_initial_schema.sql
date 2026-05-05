-- DiningView: Full Schema (Phase 1)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. stores
-- ============================================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. users
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('owner', 'manager', 'marketing', 'investor')) DEFAULT 'manager',
  store_id UUID REFERENCES stores(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. daily_sales
-- ============================================================
CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  channel TEXT CHECK (channel IN ('dine_in_local', 'dine_in_tourist')),
  -- POS summary fields
  revenue NUMERIC,
  net_sales NUMERIC,
  net_revenue NUMERIC(12, 0),
  service_charge NUMERIC,
  discount_amount NUMERIC,
  refund NUMERIC,
  pre_order_deposit NUMERIC,
  pre_order_deposit_refund NUMERIC,
  gift_card_refund NUMERIC,
  rounding_differences NUMERIC,
  tips NUMERIC,
  guests INTEGER,
  orders INTEGER,
  avg_spending NUMERIC,
  table_turnover_rate NUMERIC,
  cash_amount NUMERIC,
  card_amount NUMERIC,
  other_tender_amount NUMERIC,
  total_tendered NUMERIC,
  -- Member fields
  member_visits INTEGER,
  new_members INTEGER,
  regular_members INTEGER,
  total_members INTEGER,
  invited_members INTEGER,
  new_reachable_members INTEGER,
  -- derived
  is_weekend BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

-- ============================================================
-- 4. hourly_sales
-- ============================================================
CREATE TABLE hourly_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  net_sales NUMERIC,
  total_tendered NUMERIC,
  transaction_count INTEGER,
  guest_count INTEGER,
  avg_sales NUMERIC,
  quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date, hour)
);

-- ============================================================
-- 5. product_sales
-- ============================================================
CREATE TABLE product_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT,
  product_type TEXT,
  sub_product_type TEXT,
  product_code TEXT,
  price NUMERIC,
  quantity_sold INTEGER,
  discount_amount NUMERIC,
  revenue NUMERIC,
  total_cost NUMERIC,
  gross_profit NUMERIC,
  gross_margin NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date, product_name)
);

-- ============================================================
-- 6. order_items
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  order_number TEXT,
  order_type TEXT,
  time TIMESTAMPTZ,
  tender TEXT,
  guest_count INTEGER,
  subtotal NUMERIC,
  discount NUMERIC,
  order_total NUMERIC,
  item_name TEXT,
  item_type TEXT,
  product_type TEXT,
  item_amount NUMERIC,
  item_quantity INTEGER,
  cost NUMERIC,
  modifier_name TEXT,
  modifier_value TEXT,
  member_phone TEXT,
  member_tier TEXT,
  member_card_id TEXT,
  source TEXT DEFAULT 'pos',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_order_items_upsert ON order_items(store_id, order_number, item_name, COALESCE(modifier_name, ''));

-- ============================================================
-- 7. product_costs
-- ============================================================
CREATE TABLE product_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  product_name TEXT NOT NULL,
  product_code TEXT,
  category TEXT,
  unit_cost NUMERIC,
  selling_price NUMERIC,
  gross_margin NUMERIC,
  last_updated DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, product_name)
);

-- ============================================================
-- 8. campaigns
-- ============================================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  type TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  budget NUMERIC,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. upload_history
-- ============================================================
CREATE TABLE upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_details JSONB,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. gsc_brand_search (Phase 2)
-- ============================================================
CREATE TABLE gsc_brand_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  query TEXT NOT NULL,
  clicks INTEGER,
  impressions INTEGER,
  ctr NUMERIC,
  position NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date, query)
);

-- ============================================================
-- 11. ga4_events (Phase 2)
-- ============================================================
CREATE TABLE ga4_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  event_name TEXT NOT NULL,
  event_count INTEGER,
  user_count INTEGER,
  new_users INTEGER,
  sessions INTEGER,
  page_path TEXT,
  source TEXT,
  medium TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_ga4_events_upsert ON ga4_events(store_id, date, event_name, COALESCE(page_path, ''));

-- ============================================================
-- 12. member_conversion_daily (Phase 2)
-- ============================================================
CREATE TABLE member_conversion_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  ga4_clicks INTEGER,
  new_members INTEGER,
  conversion_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

-- ============================================================
-- 13. weather_daily (Phase 2)
-- ============================================================
CREATE TABLE weather_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  temp_high NUMERIC,
  temp_low NUMERIC,
  humidity NUMERIC,
  precipitation NUMERIC,
  weather_code TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

-- ============================================================
-- 14. competitor_events (Phase 2)
-- ============================================================
CREATE TABLE competitor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE,
  competitor_name TEXT,
  event_type TEXT,
  description TEXT,
  impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. ad_campaigns (Phase 2)
-- ============================================================
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  spend NUMERIC,
  conversions INTEGER,
  ctr NUMERIC,
  cpc NUMERIC,
  roas NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date, platform, campaign_name)
);

-- ============================================================
-- 16. ai_analysis_reports (Phase 2)
-- ============================================================
CREATE TABLE ai_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  report_type TEXT NOT NULL,
  report_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  content JSONB,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, report_type, report_date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_daily_sales_store_date ON daily_sales(store_id, date DESC);
CREATE INDEX idx_hourly_sales_store_date ON hourly_sales(store_id, date DESC);
CREATE INDEX idx_product_sales_store_date ON product_sales(store_id, date DESC);
CREATE INDEX idx_order_items_store_date ON order_items(store_id, date DESC);
CREATE INDEX idx_order_items_order ON order_items(store_id, order_number);
CREATE INDEX idx_campaigns_store_dates ON campaigns(store_id, start_date, end_date);
CREATE INDEX idx_upload_history_store ON upload_history(store_id, created_at DESC);

CREATE INDEX idx_weather_store_date ON weather_daily(store_id, date DESC);
CREATE INDEX idx_ad_campaigns_store_date ON ad_campaigns(store_id, date DESC);
CREATE INDEX idx_gsc_store_date ON gsc_brand_search(store_id, date DESC);
CREATE INDEX idx_ga4_store_date ON ga4_events(store_id, date DESC);
CREATE INDEX idx_member_conv_store_date ON member_conversion_daily(store_id, date DESC);
CREATE INDEX idx_ai_reports_store ON ai_analysis_reports(store_id, report_date DESC);

-- ============================================================
-- SEED DATA: Default store (NOM Dining)
-- ============================================================
INSERT INTO stores (id, name, location, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'NOM Dining',
  'Ho Chi Minh City',
  'Asia/Ho_Chi_Minh'
);
