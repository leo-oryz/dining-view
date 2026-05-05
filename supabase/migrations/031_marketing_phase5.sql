-- Phase 5: Marketing Layer
-- GoHighLevel email campaigns, Instagram/Facebook Graph metrics,
-- TikTok for Business metrics, Xiaohongshu manual entries.

-- ============================================================
-- Social media accounts registry
-- ============================================================
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'instagram' | 'facebook' | 'tiktok' | 'xiaohongshu'
  account_handle TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, platform)
);

-- ============================================================
-- Daily platform-level metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS social_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER,
  reach INTEGER,
  impressions INTEGER,
  profile_visits INTEGER,
  website_clicks INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, platform, date)
);

-- ============================================================
-- Per-post metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  post_type TEXT, -- 'post' | 'reel' | 'story' | 'video'
  posted_at TIMESTAMPTZ,
  caption_snippet TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, platform, post_id)
);

-- ============================================================
-- GHL email campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ghl_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  sends INTEGER DEFAULT 0,
  deliveries INTEGER DEFAULT 0,
  opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  unsubscribes INTEGER DEFAULT 0,
  bounces INTEGER DEFAULT 0,
  open_rate NUMERIC(5,2),
  ctr NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, ghl_campaign_id)
);

-- ============================================================
-- Email -> reservation attribution
-- ============================================================
CREATE TABLE IF NOT EXISTS email_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  attributed_at TIMESTAMPTZ DEFAULT now(),
  utm_campaign TEXT,
  UNIQUE(store_id, campaign_id, reservation_id)
);

-- ============================================================
-- XHS manual input (no official API)
-- ============================================================
CREATE TABLE IF NOT EXISTS xhs_manual_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  followers INTEGER,
  total_likes INTEGER,
  total_comments INTEGER,
  top_post_title TEXT,
  top_post_views INTEGER,
  notes TEXT,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_social_daily_store_platform_date
  ON social_daily_metrics(store_id, platform, date DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_store_platform
  ON social_post_metrics(store_id, platform, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_store
  ON email_campaigns(store_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_bookings_store_campaign
  ON email_bookings(store_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_xhs_manual_store_date
  ON xhs_manual_metrics(store_id, date DESC);

-- ============================================================
-- RLS — match the project pattern in 002_auth_rls.sql / 030_operations_phase4.sql
-- ============================================================
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_manual_metrics ENABLE ROW LEVEL SECURITY;

-- social_accounts
CREATE POLICY "users_select_social_accounts" ON social_accounts FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_social_accounts" ON social_accounts FOR ALL USING (
  auth.role() = 'service_role'
);

-- social_daily_metrics
CREATE POLICY "users_select_social_daily" ON social_daily_metrics FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_social_daily" ON social_daily_metrics FOR ALL USING (
  auth.role() = 'service_role'
);

-- social_post_metrics
CREATE POLICY "users_select_social_post" ON social_post_metrics FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_social_post" ON social_post_metrics FOR ALL USING (
  auth.role() = 'service_role'
);

-- email_campaigns
CREATE POLICY "users_select_email_campaigns" ON email_campaigns FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_email_campaigns" ON email_campaigns FOR ALL USING (
  auth.role() = 'service_role'
);

-- email_bookings
CREATE POLICY "users_select_email_bookings" ON email_bookings FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_email_bookings" ON email_bookings FOR ALL USING (
  auth.role() = 'service_role'
);

-- xhs_manual_metrics — managers can also write to their own store
CREATE POLICY "users_select_xhs_manual" ON xhs_manual_metrics FOR SELECT USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_insert_xhs_manual" ON xhs_manual_metrics FOR INSERT WITH CHECK (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "users_update_xhs_manual" ON xhs_manual_metrics FOR UPDATE USING (
  get_user_role() = 'owner' OR store_id = get_user_store_id()
);
CREATE POLICY "service_all_xhs_manual" ON xhs_manual_metrics FOR ALL USING (
  auth.role() = 'service_role'
);
