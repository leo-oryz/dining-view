# Database Rules

## Schema Conventions
- All primary keys: `id UUID DEFAULT gen_random_uuid()`
- All tables have `created_at TIMESTAMPTZ DEFAULT now()`
- Foreign keys reference `stores(id)` via `store_id`
- Use `UNIQUE` constraints for upsert targets (typically `store_id + date + identifier`)

## Query Rules
- Always use parameterized queries — never interpolate values into SQL strings
- Always filter by `store_id` in WHERE clauses
- Use `ON CONFLICT (unique_cols) DO UPDATE SET ...` for all data ingestion
- Order by `date DESC` by default for time-series queries
- Use Supabase JS client `.from().upsert()` with `onConflict` option
