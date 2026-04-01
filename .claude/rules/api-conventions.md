# API Conventions

## Response Format
All API endpoints return:
```json
{
  "success": true | false,
  "data": <payload>,
  "error": null | "error message",
  "timestamp": "ISO8601"
}
```

## Rules
- Use `NextResponse.json()` for all responses
- Return 200 for success, 400 for validation errors, 500 for server errors
- Never leak stack traces in production — return generic error message
- Pagination: cursor-based with `?cursor=<id>&limit=<n>` (default limit 50, max 200)
- Date filters: `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- Store filter: `?store_id=<uuid>` (required for all data queries)
- Upload endpoints accept `multipart/form-data` with file in `file` field
