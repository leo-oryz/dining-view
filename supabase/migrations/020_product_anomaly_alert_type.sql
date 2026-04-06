-- 020: Add product_anomaly and rating_drop to anomaly_alerts alert_type
ALTER TABLE anomaly_alerts
  DROP CONSTRAINT IF EXISTS anomaly_alerts_alert_type_check;

ALTER TABLE anomaly_alerts
  ADD CONSTRAINT anomaly_alerts_alert_type_check
  CHECK (alert_type IN (
    'revenue_drop',
    'cost_spike',
    'member_churn',
    'delivery_drop',
    'rating_drop',
    'product_anomaly'
  ));
