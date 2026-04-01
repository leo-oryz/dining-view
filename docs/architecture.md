# FnB Pulse Architecture

## Three-Layer Design

```
┌─────────────────────────────────────────────────┐
│  Data Ingestion Layer (Swappable Adapters)       │
│  Phase 1: CSV Upload                             │
│  Phase 2: eat365 API, Ocard API, Weather API     │
│  Phase 3: Cloudbeds API                          │
├─────────────────────────────────────────────────┤
│  Unified Data Model (Supabase PostgreSQL)        │
│  19 normalized tables + upload_history           │
│  All sources write to same schema                │
├─────────────────────────────────────────────────┤
│  Dashboard (Next.js 14 — Read-Only)              │
│  KPI Cards, Trends, Heatmap, Products, Members   │
│  Charts: Recharts | Styling: Tailwind CSS        │
└─────────────────────────────────────────────────┘
```

## Key Principle
The dashboard only reads from the database. Switching from CSV upload (Phase 1) to API sync (Phase 2) requires zero frontend changes.

## Data Flow
1. User uploads CSV/Excel → API route receives file
2. Parser adapter extracts + validates data → returns `{ data, errors }`
3. API route upserts data into Supabase (idempotent via ON CONFLICT)
4. Dashboard pages query Supabase and render charts

## Multi-Store
All tables include `store_id` FK. Phase 1 uses a single seeded store. Phase 2 adds store selector UI and RLS policies.
