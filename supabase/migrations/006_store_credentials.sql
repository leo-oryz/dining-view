-- Phase 5: Store Credentials
-- Add JSONB column for per-store eat365/ocard/ads credentials
-- Never exposed to client — only used by service role in backend jobs

ALTER TABLE stores
  ADD COLUMN credentials JSONB DEFAULT '{}'::jsonb;

-- Example structure:
-- {
--   "eat365": { "email": "...", "password": "..." },
--   "ocard": { "email": "...", "password": "..." },
--   "tiktok_ads": { "access_token": "...", "advertiser_id": "..." },
--   "meta_ads": { "access_token": "...", "account_id": "..." }
-- }

COMMENT ON COLUMN stores.credentials IS 'Per-store platform credentials (encrypted at rest by Supabase). Never expose to client.';

-- Add unique constraint for hotel_guest_mappings upsert (missing from 001)
ALTER TABLE hotel_guest_mappings
  ADD CONSTRAINT uq_hotel_guest_store_booking UNIQUE (store_id, hotel_booking_id);

CREATE INDEX idx_hotel_guest_store ON hotel_guest_mappings(store_id, check_in DESC);
