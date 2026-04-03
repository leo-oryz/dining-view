-- 009: Add recurring campaign support
ALTER TABLE campaigns
  ADD COLUMN recurrence_type TEXT NOT NULL DEFAULT 'once',
  ADD COLUMN recurrence_days INTEGER[];

-- Seed: 會員日活動
INSERT INTO campaigns (store_id, name, type, start_date, end_date, description, status, recurrence_type, recurrence_days)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '會員日 — 買麵包送咖啡',
  'event',
  '2026-01-01',
  NULL,
  '每週一、四會員可享買麵包送美式咖啡優惠',
  'active',
  'weekly',
  ARRAY[1, 4]
);
