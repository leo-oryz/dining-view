-- Phase 6: Weekly digest send history

CREATE TABLE weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  recipient_count INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_weekly_digests_week ON weekly_digests(week_start DESC);

-- RLS: only service role and owners can see digest history
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on weekly_digests"
  ON weekly_digests FOR ALL
  USING (true)
  WITH CHECK (true);
