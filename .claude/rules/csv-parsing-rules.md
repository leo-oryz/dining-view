# CSV/Excel Parsing Rules

## General
- Every parser returns `{ data: T[], errors: ParseError[] }` — never throws
- `ParseError = { row: number, field: string, message: string }`
- Numeric fields: strip commas, convert to number, treat NaN as null
- Date fields: normalize to YYYY-MM-DD format
- Empty/whitespace-only cells → null

## eat365 Reports
### Sales Summary (.xlsx)
- Header row at index 2 (rows 0-1 are metadata)
- Single data row per date
- Maps to `daily_sales` table

### Hourly Sales Report (.xls)
- Header at row 0, skip "Total" row at end
- Parse time ranges like "10:00 - 11:00" → hour integer (10)
- Maps to `hourly_sales` table

### Sales By Item (.xls)
- Header at row 1 (row 0 is period label)
- Maps to `product_sales` + `product_costs` tables
- Gross Margin is percentage string like "75%" → 0.75

### Transaction Report (.csv)
- Standard CSV with headers
- Rows have mixed types: order headers (Item Type empty) + line items (Item Type = "Single Item") + modifiers
- Maps to `order_items` table
- Filter out pure order-header rows (keep items + modifiers)

## Ocard Reports
### 儀表板 (.xlsx)
- Multi-sheet: use "明細" sheet for daily data, header at row 2
- Maps to `daily_sales` member fields

### 會員招募分析 / 顧客消費分析 (.csv)
- Key-value format (2 columns), section-based parsing
- Maps to `ocard_member_snapshots`

### RFM 分析 (.csv)
- Key-value format (2 columns)
- Maps to `ocard_rfm_snapshots`

### 商品銷售 (.csv)
- Tabular CSV with member-linked transactions
- Phone numbers use `="..."` quoting — strip wrapper
- Maps to `order_items` with source='ocard'
