-- Labor efficiency tables for workforce analysis
-- Stores shift definitions, staff info, daily shifts, and aggregated summaries

CREATE TABLE shift_definitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  name             TEXT,
  start_time       TIME,
  end_time         TIME,
  break_start      TIME,
  break_end        TIME,
  scheduled_hours  NUMERIC(4,2),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, code)
);

CREATE TABLE staff (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id) ON DELETE CASCADE,
  employee_id      TEXT NOT NULL,
  name             TEXT NOT NULL,
  name_en          TEXT,
  employment_type  TEXT DEFAULT 'full_time',
  hourly_rate      NUMERIC(8,2),
  monthly_salary   NUMERIC(10,2),
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, employee_id)
);

CREATE TABLE staff_shifts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id) ON DELETE CASCADE,
  staff_id         UUID REFERENCES staff(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  shift_code       TEXT,
  scheduled_hours  NUMERIC(4,2),
  actual_hours     NUMERIC(4,2),
  overtime_hours   NUMERIC(4,2)
    GENERATED ALWAYS AS
    (GREATEST(actual_hours - scheduled_hours, 0)) STORED,
  is_day_off       BOOLEAN DEFAULT FALSE,
  is_absent        BOOLEAN DEFAULT FALSE,
  labor_cost       NUMERIC(10,2),
  data_source      TEXT DEFAULT 'nueip_csv',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, staff_id, date)
);

CREATE TABLE labor_daily_summary (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID REFERENCES stores(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  staff_count           INTEGER,
  total_scheduled_hours NUMERIC(8,2),
  total_actual_hours    NUMERIC(8,2),
  total_overtime_hours  NUMERIC(8,2),
  total_labor_cost      NUMERIC(12,2),
  revenue               NUMERIC(12,2),
  labor_cost_ratio      NUMERIC(5,4),
  revenue_per_hour      NUMERIC(10,2),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, date)
);

CREATE TABLE labor_hourly (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  time_slot_start   TIME NOT NULL,
  staff_count       INTEGER,
  revenue           NUMERIC(10,2),
  revenue_per_staff NUMERIC(10,2),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, date, time_slot_start)
);

-- Indexes for common query patterns
CREATE INDEX idx_staff_shifts_store_date ON staff_shifts(store_id, date);
CREATE INDEX idx_labor_daily_summary_store_date ON labor_daily_summary(store_id, date);
CREATE INDEX idx_labor_hourly_store_date ON labor_hourly(store_id, date);
CREATE INDEX idx_staff_store_active ON staff(store_id, is_active);
