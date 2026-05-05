-- Store Credentials
-- Per-store platform credentials (e.g., TableCheck, GHL, ad platforms)
-- Never exposed to client — only used by service role in backend jobs

ALTER TABLE stores
  ADD COLUMN credentials JSONB DEFAULT '{}'::jsonb;

-- Example structure:
-- {
--   "tablecheck": { "api_key": "...", "venue_id": "..." },
--   "tiktok_ads": { "access_token": "...", "advertiser_id": "..." },
--   "meta_ads": { "access_token": "...", "account_id": "..." }
-- }

COMMENT ON COLUMN stores.credentials IS 'Per-store platform credentials (encrypted at rest by Supabase). Never expose to client.';
