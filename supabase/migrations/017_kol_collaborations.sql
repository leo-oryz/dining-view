-- KOL Collaboration Management
-- Two tables: kol_collaborations (master) + kol_posts (per-platform posts)

CREATE TABLE kol_collaborations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE,
  kol_name          TEXT NOT NULL,
  kol_handle        TEXT,
  collaboration_date DATE NOT NULL,
  featured_products TEXT[],
  collaboration_fee NUMERIC(10,2),
  fee_type          TEXT CHECK (fee_type IN ('cash', 'product', 'hybrid')),
  responsible_staff TEXT,
  notes             TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kol_collaborations_store_date
  ON kol_collaborations(store_id, collaboration_date);

CREATE TABLE kol_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id  UUID REFERENCES kol_collaborations(id) ON DELETE CASCADE,
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL
    CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'threads', 'youtube')),
  post_url          TEXT NOT NULL,
  post_date         DATE,
  views             INTEGER,
  likes             INTEGER,
  comments          INTEGER,
  shares            INTEGER,
  saves             INTEGER,
  reach             INTEGER,
  last_synced_at    TIMESTAMPTZ,
  sync_status       TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error        TEXT,
  apify_run_id      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collaboration_id, post_url)
);

CREATE INDEX idx_kol_posts_store ON kol_posts(store_id);
CREATE INDEX idx_kol_posts_collaboration ON kol_posts(collaboration_id);
