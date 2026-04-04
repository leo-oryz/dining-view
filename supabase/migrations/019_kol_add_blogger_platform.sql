-- Add 'blogger' to kol_posts platform check constraint
ALTER TABLE kol_posts DROP CONSTRAINT IF EXISTS kol_posts_platform_check;
ALTER TABLE kol_posts ADD CONSTRAINT kol_posts_platform_check
  CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'threads', 'youtube', 'blogger'));