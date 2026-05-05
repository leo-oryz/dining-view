-- Phase 6a: Intelligence Layer
-- Calendarific holiday sync (9 countries), AviationStack flight capacity
-- monitoring, alert rules + history.

-- ============================================================
-- Holidays — Calendarific data, shared across stores
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  name_local TEXT,
  type TEXT NOT NULL DEFAULT 'public',
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, date, name)
);

-- ============================================================
-- Flight capacity — weekly aggregates from AviationStack
-- ============================================================
CREATE TABLE IF NOT EXISTS flight_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arrival_airport TEXT NOT NULL,
  origin_country TEXT NOT NULL,
  week_start DATE NOT NULL,
  total_seats INTEGER NOT NULL DEFAULT 0,
  flight_count INTEGER NOT NULL DEFAULT 0,
  wow_change_pct NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(arrival_airport, origin_country, week_start)
);

-- ============================================================
-- Alert rules — per-store toggles for each alert type
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, alert_type)
);

-- ============================================================
-- Alert history — fired alerts, for inbox UI in Phase 6b
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_holidays_country_date
  ON holidays(country_code, date);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_flight_capacity_airport_country_week
  ON flight_capacity(arrival_airport, origin_country, week_start);
CREATE INDEX IF NOT EXISTS idx_alert_history_store_triggered
  ON alert_history(store_id, triggered_at DESC);

-- ============================================================
-- RLS — match the project pattern (get_user_role / get_user_store_id)
-- ============================================================
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- holidays — global reference data, readable by any authenticated user
CREATE POLICY "users_select_holidays" ON holidays FOR SELECT USING (
  auth.role() = 'authenticated'
);
CREATE POLICY "service_all_holidays" ON holidays FOR ALL USING (
  auth.role() = 'service_role'
);

-- flight_capacity — global reference data
CREATE POLICY "users_select_flight_capacity" ON flight_capacity FOR SELECT USING (
  auth.role() = 'authenticated'
);
CREATE POLICY "service_all_flight_capacity" ON flight_capacity FOR ALL USING (
  auth.role() = 'service_role'
);

-- alert_rules — per-store
CREATE POLICY "users_select_alert_rules" ON alert_rules FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_insert_alert_rules" ON alert_rules FOR INSERT WITH CHECK (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_update_alert_rules" ON alert_rules FOR UPDATE USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_alert_rules" ON alert_rules FOR ALL USING (
  auth.role() = 'service_role'
);

-- alert_history — per-store, users can mark as read
CREATE POLICY "users_select_alert_history" ON alert_history FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_update_alert_history" ON alert_history FOR UPDATE USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_alert_history" ON alert_history FOR ALL USING (
  auth.role() = 'service_role'
);
