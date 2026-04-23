-- Phase 1 of staff-turnover hardening.
-- Adds:
--   1. Staff lifecycle tracking (hired_at / left_at / last_seen_date / requires_review)
--   2. Per-shift salary snapshots so historical labor_cost is immutable on re-upload

-- ─── staff: lifecycle columns ──────────────────────────────────────────────
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS hired_at        DATE,
  ADD COLUMN IF NOT EXISTS left_at         DATE,
  ADD COLUMN IF NOT EXISTS last_seen_date  DATE,
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill last_seen_date from existing staff_shifts
UPDATE staff s
SET last_seen_date = latest.max_date
FROM (
  SELECT staff_id, MAX(date) AS max_date
  FROM staff_shifts
  GROUP BY staff_id
) latest
WHERE s.id = latest.staff_id;

-- Every existing staff row was auto-created with no salary; mark them all for review.
UPDATE staff SET requires_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_staff_store_requires_review
  ON staff(store_id, requires_review) WHERE requires_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_staff_store_last_seen
  ON staff(store_id, last_seen_date DESC);

-- ─── staff_shifts: immutable salary snapshot ───────────────────────────────
ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS employment_type_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS hourly_rate_snapshot     NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS monthly_salary_snapshot  NUMERIC(10,2);

COMMENT ON COLUMN staff_shifts.employment_type_snapshot IS
  'Frozen at upload time so re-uploading the same period after a pay change does not rewrite history.';
