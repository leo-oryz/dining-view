CREATE OR REPLACE FUNCTION upsert_ga4_event(
  p_store_id UUID,
  p_date DATE,
  p_event_name TEXT,
  p_event_count INTEGER,
  p_user_count INTEGER,
  p_new_users INTEGER,
  p_sessions INTEGER,
  p_page_path TEXT,
  p_source TEXT,
  p_medium TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO ga4_events (store_id, date, event_name, event_count, user_count, new_users, sessions, page_path, source, medium)
  VALUES (p_store_id, p_date, p_event_name, p_event_count, p_user_count, p_new_users, p_sessions, p_page_path, p_source, p_medium)
  ON CONFLICT (store_id, date, event_name, COALESCE(page_path, ''))
  DO UPDATE SET
    event_count = EXCLUDED.event_count,
    user_count = EXCLUDED.user_count,
    new_users = EXCLUDED.new_users,
    sessions = EXCLUDED.sessions,
    source = EXCLUDED.source,
    medium = EXCLUDED.medium;
END;
$$ LANGUAGE plpgsql;
