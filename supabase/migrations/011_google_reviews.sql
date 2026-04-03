-- Google Reviews tables for Apify scraper integration

CREATE TABLE google_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE,
  review_id         TEXT NOT NULL,
  reviewer_name     TEXT,
  rating            INTEGER,
  review_text       TEXT,
  review_date       DATE NOT NULL,
  is_negative       BOOLEAN,
  language          TEXT DEFAULT 'zh-TW',
  source            TEXT DEFAULT 'apify',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, review_id)
);

CREATE TABLE google_review_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE,
  snapshot_date     DATE NOT NULL,
  total_reviews     INTEGER,
  avg_rating        NUMERIC(3,2),
  new_reviews_count INTEGER,
  negative_count    INTEGER,
  rating_breakdown  JSONB,
  ai_negative_summary TEXT,
  ai_sentiment_trend  TEXT,
  keywords          TEXT[],
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, snapshot_date)
);

-- Performance indexes
CREATE INDEX idx_google_reviews_store_date ON google_reviews(store_id, review_date);
CREATE INDEX idx_google_review_snapshots_store_date ON google_review_snapshots(store_id, snapshot_date);
