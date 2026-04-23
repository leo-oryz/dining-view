-- Payroll records: monthly source-of-truth for actual labor cost.
-- Replaces the Phase 2 "derive cost from config" approach since the business
-- already has per-month real payouts — using derived values would always be
-- approximate while this is actual ground truth.

CREATE TABLE payroll_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  staff_id        UUID REFERENCES staff(id) ON DELETE CASCADE,
  year            INT  NOT NULL,
  month           INT  NOT NULL CHECK (month BETWEEN 1 AND 12),
  department      TEXT,
  job_title       TEXT,
  total_payable   NUMERIC(10,2) NOT NULL,
  actual_hours    NUMERIC(6,2)  NOT NULL,
  overtime_hours  NUMERIC(6,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, staff_id, year, month)
);

CREATE INDEX idx_payroll_store_period ON payroll_records(store_id, year, month);
CREATE INDEX idx_payroll_staff        ON payroll_records(staff_id, year, month);

-- Department lives on staff because it's a person attribute, not shift-level.
-- Filled in automatically when payroll is uploaded (job_title "Part Time" → PT;
-- everything else → full-time).
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS job_title  TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_store_department
  ON staff(store_id, department);
