-- Add tracking/workflow columns to kol_collaborations from CSV import format

ALTER TABLE kol_collaborations
  ADD COLUMN contract_number    TEXT,            -- 合約編號 e.g. K-TWBE-0007-ZAC
  ADD COLUMN real_name          TEXT,            -- 真實姓名
  ADD COLUMN platform           TEXT,            -- 社交媒體平台 (Instagram, Blogger, etc.)
  ADD COLUMN party_size         TEXT,            -- 人數 e.g. "2 人"
  ADD COLUMN visit_time         TIME,            -- 探店時間（時間部分）
  ADD COLUMN contact_info       TEXT,            -- 聯繫資訊（電話等）
  ADD COLUMN confirmation_status TEXT DEFAULT 'pending',  -- 確認狀態
  ADD COLUMN contract_sent      TEXT DEFAULT 'pending',   -- 合約寄出
  ADD COLUMN visit_status       TEXT DEFAULT 'pending',   -- 到店狀況
  ADD COLUMN content_status     TEXT DEFAULT 'pending',   -- 素材狀況
  ADD COLUMN content_type       TEXT,            -- 素材類別 (Reels, Blog, etc.)
  ADD COLUMN invoice_status_1   TEXT DEFAULT 'pending',   -- 請款流程01
  ADD COLUMN invoice_status_2   TEXT DEFAULT 'pending',   -- 請款流程02
  ADD COLUMN payment_status     TEXT DEFAULT 'pending',   -- 付款狀態
  ADD COLUMN content_url        TEXT,            -- 素材連結
  ADD COLUMN engagement_rate    NUMERIC(6,2);    -- 互動率 (%)

-- Add unique constraint for upsert on contract_number
CREATE UNIQUE INDEX idx_kol_collab_contract
  ON kol_collaborations(store_id, contract_number)
  WHERE contract_number IS NOT NULL;

-- Also allow upsert by (store_id, kol_name, collaboration_date) for rows without contract_number
CREATE UNIQUE INDEX idx_kol_collab_name_date
  ON kol_collaborations(store_id, kol_name, collaboration_date);
