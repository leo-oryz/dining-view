-- Owner-configured AI report schedules. Each row is one scheduled email send
-- (e.g. "每週週報 — 週一 09:00", "每月月報 — 3 號 09:00"). The hourly dispatcher
-- (`/api/cron/report-dispatcher`) selects rows where now >= next_run_at and
-- fires them. After firing, last_run_at + next_run_at are updated.

CREATE TABLE report_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,

  -- When to send (wall-clock in `timezone`)
  frequency         TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week       INT  CHECK (day_of_week BETWEEN 1 AND 7),    -- 1=Mon ... 7=Sun (ISO)
  day_of_month      INT  CHECK (day_of_month BETWEEN 1 AND 28),  -- cap at 28 to avoid Feb edge cases
  send_hour         INT  NOT NULL DEFAULT 9 CHECK (send_hour BETWEEN 0 AND 23),
  send_minute       INT  NOT NULL DEFAULT 0 CHECK (send_minute BETWEEN 0 AND 59),
  timezone          TEXT NOT NULL DEFAULT 'Asia/Taipei',

  -- What to send
  -- period_type: which date range the report covers, derived at fire time.
  -- last_week  → previous Mon-Sun
  -- last_month → previous calendar month
  period_type       TEXT NOT NULL CHECK (period_type IN ('last_week', 'last_month')),
  -- Subset of {attribution, star_products, retire_candidates}. UI may add more later.
  report_types      JSONB NOT NULL DEFAULT '["attribution","star_products","retire_candidates"]'::jsonb,
  -- Affects Claude max_tokens, prompt verbosity, and email summary length.
  depth             TEXT NOT NULL DEFAULT 'standard' CHECK (depth IN ('concise', 'standard', 'detailed')),

  -- Recipients: union of all users with these roles + extra_emails
  recipient_roles   JSONB NOT NULL DEFAULT '["owner","marketing"]'::jsonb,
  extra_emails      JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Bookkeeping
  next_run_at       TIMESTAMPTZ,            -- computed by app on insert/update
  last_run_at       TIMESTAMPTZ,
  last_run_status   TEXT CHECK (last_run_status IN ('success', 'error')),
  last_run_error    TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),

  CONSTRAINT freq_day_consistency CHECK (
    (frequency = 'weekly'  AND day_of_week  IS NOT NULL AND day_of_month IS NULL) OR
    (frequency = 'monthly' AND day_of_month IS NOT NULL AND day_of_week  IS NULL)
  )
);

CREATE INDEX idx_report_schedules_due ON report_schedules(is_active, next_run_at);

-- Seed: mirror the previous hard-coded behavior so nothing changes for the
-- owner when this ships. Old GitHub Actions cron (Mon 04:00 UTC) = Asia/Taipei
-- Mon 12:00. next_run_at left NULL — backfilled on first save via API.
INSERT INTO report_schedules (name, frequency, day_of_week, send_hour, send_minute, period_type)
VALUES ('每週週報', 'weekly', 1, 12, 0, 'last_week');
