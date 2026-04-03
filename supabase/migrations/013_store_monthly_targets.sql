-- Store monthly revenue targets for KPI tracking
CREATE TABLE store_monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  month DATE NOT NULL, -- first day of the month, e.g. '2026-04-01'
  revenue_target NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, month)
);

CREATE INDEX idx_store_monthly_targets_store_month
  ON store_monthly_targets (store_id, month DESC);
