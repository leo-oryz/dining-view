-- Phase 2: iPOS data ingestion pipeline
-- Adds columns required by iPOS exports (sale_summary, payment_methods, items, source).
-- Existing daily_sales / hourly_sales / product_sales tables stay backward-compatible;
-- iPOS-specific columns are added alongside legacy ones.

-- ============================================================
-- daily_sales: gross revenue, invoice count, payment breakdown
-- ============================================================
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS gross_revenue           bigint;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS invoice_count           integer;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_visa_amount     bigint  DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_visa_count      integer DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_transfer_amount bigint  DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_transfer_count  integer DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_deposit_amount  bigint  DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_deposit_count   integer DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_cash_amount     bigint  DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS payment_cash_count      integer DEFAULT 0;

-- ============================================================
-- hourly_sales: iPOS field aliases (existing has net_sales / transaction_count / guest_count)
-- ============================================================
ALTER TABLE hourly_sales ADD COLUMN IF NOT EXISTS net_revenue   bigint;
ALTER TABLE hourly_sales ADD COLUMN IF NOT EXISTS invoice_count integer;
ALTER TABLE hourly_sales ADD COLUMN IF NOT EXISTS cover_count   integer;

-- ============================================================
-- product_sales: SKU-level fields from items_report.xlsx
-- The existing UNIQUE(store_id, date, product_name) constraint is reused;
-- iPOS parser writes sku_name into product_name and sku_id into sku_id.
-- ============================================================
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS sku_id        text;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS sku_name      text;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS unit          text;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS item_type     text;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS net_revenue   bigint;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS gross_revenue bigint;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS avg_price     bigint;

CREATE INDEX IF NOT EXISTS idx_product_sales_store_sku ON product_sales(store_id, sku_id, date DESC);
