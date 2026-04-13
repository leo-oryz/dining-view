-- Phase 5: Anomaly Alerts
-- Table for storing detected anomalies + notification status

CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'revenue_drop',
    'cost_spike',
    'member_churn',
    'delivery_drop'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  metric_value NUMERIC,
  threshold_value NUMERIC,
  message TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique per (store, type, day) — expression requires a separate index, not an inline UNIQUE constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_anomaly_alerts_store_type_day
  ON anomaly_alerts (store_id, alert_type, (created_at::date));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_store_date ON anomaly_alerts(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_type ON anomaly_alerts(alert_type, created_at DESC);

-- RLS
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view all alerts"
  ON anomaly_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'owner'
    )
  );

CREATE POLICY "Manager can view own store alerts"
  ON anomaly_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.store_id = anomaly_alerts.store_id
    )
  );
