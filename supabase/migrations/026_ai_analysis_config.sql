-- Per-store AI analysis configuration. Owner edits these via Settings UI;
-- claudeAnalyzer reads them when building prompts (fall back to defaults
-- encoded here when a row doesn't exist or a column is NULL).

CREATE TABLE ai_analysis_config (
  store_id                    UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,

  -- Common business context injected at the top of every AI report prompt.
  business_context            TEXT,

  -- labor_cost knobs
  labor_target_cost_ratio     NUMERIC(5,4) NOT NULL DEFAULT 0.30,
  labor_pt_healthy_min        NUMERIC(5,4) NOT NULL DEFAULT 0.30,
  labor_pt_healthy_max        NUMERIC(5,4) NOT NULL DEFAULT 0.40,
  labor_ot_monthly_cap        INT          NOT NULL DEFAULT 46,
  labor_ot_quarterly_cap      INT          NOT NULL DEFAULT 138,
  labor_ft_low_threshold      INT          NOT NULL DEFAULT 140,
  labor_pt_high_threshold     INT          NOT NULL DEFAULT 80,

  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_by                  UUID REFERENCES users(id)
);

-- Seed a row for every existing store so reads always hit a row.
INSERT INTO ai_analysis_config (store_id)
SELECT id FROM stores
ON CONFLICT DO NOTHING;
