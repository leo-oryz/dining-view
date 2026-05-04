-- Add detailed store fields for enhanced store management
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS business_hours   TEXT,
  ADD COLUMN IF NOT EXISTS opened_date      DATE,
  ADD COLUMN IF NOT EXISTS google_maps_url  TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id  TEXT,
  ADD COLUMN IF NOT EXISTS seat_count       INTEGER,
  ADD COLUMN IF NOT EXISTS manager_name     TEXT,
  ADD COLUMN IF NOT EXISTS manager_email    TEXT;
