# Lessons Learned

## Phase 1

### eat365 File Formats
- Sales Summary xlsx has header at row 2, not row 0. Rows 0-1 are metadata.
- Sales By Item xls has header at row 1. Row 0 is a period label.
- Transaction Report CSV mixes order-level rows with item-level rows. Must filter by Item Type.
- Hourly Sales has a "Total" row at the end that must be excluded.

### Ocard File Formats
- 會員招募分析 and 顧客消費分析 are NOT tabular CSVs. They are key-value pair format with sections. Must parse by scanning for known key names.
- 儀表板 xlsx has 3 sheets. "明細" sheet has daily data with header at row 2.
- 商品銷售 CSV has phone numbers wrapped in `="..."` Excel quoting. Must strip the wrapper.

### Architecture
- Always upsert (ON CONFLICT DO UPDATE) — users may re-upload the same file.
- Return structured error arrays from parsers, never throw exceptions.
- Keep SUPABASE_SERVICE_ROLE_KEY server-side only. Never prefix with NEXT_PUBLIC_.
