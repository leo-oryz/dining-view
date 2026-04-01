# API Specification

## Response Format
```json
{ "success": boolean, "data": any, "error": string | null, "timestamp": "ISO8601" }
```

## Endpoints

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |

### Upload (POST, multipart/form-data)
| Path | File Type | Target Table(s) |
|------|-----------|-----------------|
| `/api/upload/eat365-summary` | .xlsx | daily_sales |
| `/api/upload/eat365-hourly` | .xls | hourly_sales |
| `/api/upload/eat365-items` | .xls | product_sales, product_costs |
| `/api/upload/eat365-transactions` | .csv | order_items |
| `/api/upload/ocard-dashboard` | .xlsx | daily_sales (member fields) |
| `/api/upload/ocard-members` | .csv | order_items (source=ocard) |
| `/api/upload/ocard-recruit` | .csv | ocard_member_snapshots |
| `/api/upload/ocard-consumption` | .csv | ocard_member_snapshots |
| `/api/upload/ocard-rfm` | .csv | ocard_rfm_snapshots |

### Upload History
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/upload/history` | List upload records |

### Sales Queries (GET)
| Path | Params | Description |
|------|--------|-------------|
| `/api/sales/daily` | store_id, start_date, end_date | Daily sales data |
| `/api/sales/hourly` | store_id, date | Hourly breakdown |
| `/api/sales/products` | store_id, start_date, end_date | Product ranking |

### Campaigns
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |

### Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products/costs` | Product cost data |
