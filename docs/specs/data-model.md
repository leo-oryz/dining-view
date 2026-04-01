# Data Model

See `supabase/migrations/001_initial_schema.sql` for the full schema.

## Table Overview

| Table | Purpose | Phase |
|-------|---------|-------|
| stores | Store registry | 1 |
| daily_sales | Daily revenue + member metrics | 1 |
| hourly_sales | Hourly time-slot breakdown | 1 |
| product_sales | SKU-level daily sales | 1 |
| order_items | Transaction line items | 1 |
| product_costs | Product cost/margin reference | 1 |
| upload_history | File upload tracking | 1 |
| campaigns | Promotions & events | 1 |
| users | System users | 1 (basic) |
| ocard_member_snapshots | Ocard period summaries | 1 |
| ocard_rfm_snapshots | RFM analysis snapshots | 1 |
| hotel_guest_mappings | Hotel ↔ restaurant matching | 3 |
| gsc_brand_search | Google Search Console | 2 |
| ga4_events | Google Analytics events | 2 |
| member_conversion_daily | Cross-source conversion | 2 |
| weather_daily | Daily weather data | 2 |
| competitor_events | Competitor activity log | 2 |
| delivery_sales | Delivery platform sales | 2 |
| ad_campaigns | Paid ad performance | 2 |
| ai_analysis_reports | AI report cache | 2 |

## Key Relationships
- All tables reference `stores(id)` via `store_id`
- `order_items` links to transactions from both eat365 and Ocard (via `source` column)
- `daily_sales` aggregates data from eat365 summary + Ocard dashboard
