-- Add share_token column for public report sharing
ALTER TABLE ai_analysis_reports
  ADD COLUMN share_token TEXT UNIQUE;

CREATE INDEX idx_ai_reports_share_token ON ai_analysis_reports(share_token)
  WHERE share_token IS NOT NULL;
