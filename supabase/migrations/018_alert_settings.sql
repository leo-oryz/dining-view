-- Alert notification settings per store
CREATE TABLE IF NOT EXISTS alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  alert_emails TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id)
);

-- RLS
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on alert_settings"
  ON alert_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX idx_alert_settings_store ON alert_settings(store_id);
