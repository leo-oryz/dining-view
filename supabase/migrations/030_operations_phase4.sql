-- Phase 4: Operations Layer
-- BetterHR-sourced HR tables (employees, attendance, payroll, leave) + manual daily inputs.

-- ============================================================
-- HR: Employees
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  betterhr_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  employment_type TEXT, -- full_time | part_time | contractor
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, betterhr_id)
);

-- ============================================================
-- HR: Attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  hours_worked NUMERIC(4,2),
  is_late BOOLEAN NOT NULL DEFAULT false,
  is_absent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- ============================================================
-- HR: Payroll (period-level aggregate)
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_cost BIGINT NOT NULL DEFAULT 0,
  cost_by_department JSONB,
  headcount INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, period_start, period_end)
);

-- ============================================================
-- HR: Leave
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL, -- annual | sick | unpaid | other
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Manual daily inputs (phone inquiries, walk-ins, notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_manual_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  phone_inquiries INTEGER NOT NULL DEFAULT 0,
  walk_ins_estimate INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

-- ============================================================
-- Store-level integration settings (BetterHR credentials, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, setting_key)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hr_employees_store_active
  ON hr_employees(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_store_date
  ON hr_attendance(store_id, date);
CREATE INDEX IF NOT EXISTS idx_hr_leave_store_dates
  ON hr_leave(store_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_hr_leave_status
  ON hr_leave(store_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_store_period
  ON hr_payroll(store_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_daily_manual_store_date
  ON daily_manual_metrics(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_store_settings_store_key
  ON store_settings(store_id, setting_key);

-- ============================================================
-- RLS — owner sees all, manager sees own store, service role full access
--      (matches the pattern in 002_auth_rls.sql / 029_reservations_phase3.sql)
-- ============================================================
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_manual_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- hr_employees
CREATE POLICY "users_select_hr_employees" ON hr_employees FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_hr_employees" ON hr_employees FOR ALL USING (
  auth.role() = 'service_role'
);

-- hr_attendance
CREATE POLICY "users_select_hr_attendance" ON hr_attendance FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_hr_attendance" ON hr_attendance FOR ALL USING (
  auth.role() = 'service_role'
);

-- hr_payroll
CREATE POLICY "users_select_hr_payroll" ON hr_payroll FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_hr_payroll" ON hr_payroll FOR ALL USING (
  auth.role() = 'service_role'
);

-- hr_leave
CREATE POLICY "users_select_hr_leave" ON hr_leave FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_hr_leave" ON hr_leave FOR ALL USING (
  auth.role() = 'service_role'
);

-- daily_manual_metrics — managers can also write to their own store
CREATE POLICY "users_select_daily_manual" ON daily_manual_metrics FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_insert_daily_manual" ON daily_manual_metrics FOR INSERT WITH CHECK (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_update_daily_manual" ON daily_manual_metrics FOR UPDATE USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_daily_manual" ON daily_manual_metrics FOR ALL USING (
  auth.role() = 'service_role'
);

-- store_settings — owner-only read/write at the row level; service role full access.
-- Secret values (e.g. API keys) should only be touched by server-side code via service role.
CREATE POLICY "users_select_store_settings" ON store_settings FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_store_settings" ON store_settings FOR ALL USING (
  auth.role() = 'service_role'
);
