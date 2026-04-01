# Google API Rules (Phase 2+)

## Authentication
- Use service account JSON from `GOOGLE_SERVICE_ACCOUNT_JSON` env var
- Never store service account credentials in code or NEXT_PUBLIC_ vars

## Data Fetching
- GA4 and GSC data has 24-48h delay — never query today's date
- Implement exponential backoff retry (3 attempts, 1s/2s/4s delays)
- Cache responses in DB to avoid redundant API calls

## Error Handling
- Quota exceeded → log warning, skip, retry next cycle
- Auth errors → surface to admin, do not retry
