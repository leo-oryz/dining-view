-- Phase 3: TableCheck reservations integration
-- Adds reservations table (synced from TableCheck API) and stores.tablecheck_shop_id.
-- Reservation source channel, guest country, status are normalized in the adapter.
-- PII (guest name + phone) is sha256-hashed before persistence; raw payload kept in jsonb.

-- ============================================================
-- stores: TableCheck shop slug (e.g. "nom-dining-hcmc")
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tablecheck_shop_id text;

-- ============================================================
-- reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  tablecheck_id TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source_channel TEXT,
  guest_country TEXT,
  guest_name_hash TEXT,
  guest_phone_hash TEXT,
  no_show BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  memo TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, tablecheck_id)
);

CREATE INDEX IF NOT EXISTS idx_reservations_store_date
  ON reservations(store_id, reserved_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_status
  ON reservations(store_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_country
  ON reservations(store_id, guest_country);

-- ============================================================
-- RLS — match the project pattern in 002_auth_rls.sql
-- ============================================================
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_reservations" ON reservations FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);

CREATE POLICY "service_all_reservations" ON reservations FOR ALL USING (
  auth.role() = 'service_role'
);
