-- LINE OA broadcast tracking table
CREATE TABLE line_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  broadcast_date DATE NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  target_audience TEXT,
  friend_count_before INTEGER,
  friend_count_after INTEGER,
  delivered INTEGER,
  opened INTEGER,
  clicked INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, broadcast_date, title)
);

-- RLS
ALTER TABLE line_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner sees all line_broadcasts"
  ON line_broadcasts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'owner'
    )
  );

CREATE POLICY "Manager sees own store line_broadcasts"
  ON line_broadcasts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.store_id = line_broadcasts.store_id
    )
  );

-- Index
CREATE INDEX idx_line_broadcasts_store_date ON line_broadcasts(store_id, broadcast_date DESC);
