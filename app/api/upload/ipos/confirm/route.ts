// POST /api/upload/ipos/confirm — re-parses uploaded files and upserts to Supabase.
// Idempotent: relies on UNIQUE(store_id, date) / (store_id, date, hour) /
// (store_id, date, product_name) constraints with ON CONFLICT DO UPDATE.

import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { parseIposUpload } from '@/lib/parsers/ipos'
import type {
  DailySalesRow,
  HourlySalesRow,
  PaymentRow,
  ProductSalesRow,
} from '@/lib/parsers/ipos/types'

export const runtime = 'nodejs'
export const maxDuration = 120

async function readBuffer(file: File | null): Promise<ArrayBuffer | undefined> {
  if (!file) return undefined
  return await file.arrayBuffer()
}

interface DailyUpsertRow {
  store_id: string
  date: string
  net_revenue: number
  gross_revenue: number | null
  discount_amount: number | null
  invoice_count: number
  guests: number
  orders: number
  payment_visa_amount: number
  payment_visa_count: number
  payment_transfer_amount: number
  payment_transfer_count: number
  payment_deposit_amount: number
  payment_deposit_count: number
  payment_cash_amount: number
  payment_cash_count: number
}

function buildDailyRows(
  storeId: string,
  daily: DailySalesRow[],
  payments: PaymentRow[],
): DailyUpsertRow[] {
  const paymentMap = new Map(payments.map(p => [p.date, p]))
  const dailyMap = new Map(daily.map(d => [d.date, d]))
  const allDates = new Set<string>([...dailyMap.keys(), ...paymentMap.keys()])

  const rows: DailyUpsertRow[] = []
  for (const date of allDates) {
    const d = dailyMap.get(date)
    const p = paymentMap.get(date)
    rows.push({
      store_id: storeId,
      date,
      net_revenue: d?.net_revenue ?? 0,
      gross_revenue: d?.gross_revenue ?? null,
      discount_amount: d?.discount_amount ?? null,
      invoice_count: d?.invoice_count ?? 0,
      orders: d?.invoice_count ?? 0,        // legacy field — keep in sync
      guests: d?.cover_count ?? 0,          // legacy field — keep in sync
      payment_visa_amount: p?.visa_amount ?? 0,
      payment_visa_count: p?.visa_count ?? 0,
      payment_transfer_amount: p?.transfer_amount ?? 0,
      payment_transfer_count: p?.transfer_count ?? 0,
      payment_deposit_amount: p?.deposit_amount ?? 0,
      payment_deposit_count: p?.deposit_count ?? 0,
      payment_cash_amount: p?.cash_amount ?? 0,
      payment_cash_count: p?.cash_count ?? 0,
    })
  }
  return rows
}

function buildHourlyRows(storeId: string, rows: HourlySalesRow[]) {
  return rows.map(r => ({
    store_id: storeId,
    date: r.date,
    hour: r.hour,
    net_revenue: r.net_revenue,
    net_sales: r.net_revenue,           // legacy alias
    invoice_count: r.invoice_count,
    transaction_count: r.invoice_count, // legacy alias
    cover_count: r.cover_count,
    guest_count: r.cover_count,         // legacy alias
  }))
}

function buildProductRows(storeId: string, rows: ProductSalesRow[]) {
  return rows.map(r => ({
    store_id: storeId,
    date: r.date,
    sku_id: r.sku_id,
    sku_name: r.sku_name,
    product_name: r.sku_name,    // legacy unique key — must be populated
    product_code: r.sku_id,      // legacy alias
    unit: r.unit,
    category: r.category,
    item_type: r.item_type,
    product_type: r.item_type,   // legacy alias
    quantity_sold: r.quantity_sold,
    net_revenue: r.net_revenue,
    revenue: r.net_revenue,      // legacy alias
    gross_revenue: r.gross_revenue,
    discount_amount: r.discount_amount,
    avg_price: r.avg_price,
    price: r.avg_price,          // legacy alias
  }))
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const storeId = (formData.get('store_id') as string) || DEFAULT_STORE_ID

    const sale_summary    = await readBuffer(formData.get('sale_summary')    as File | null)
    const payment_methods = await readBuffer(formData.get('payment_methods') as File | null)
    const items           = await readBuffer(formData.get('items')           as File | null)
    const source          = await readBuffer(formData.get('source')          as File | null)

    const missing: string[] = []
    if (!sale_summary)    missing.push('sale_summary_report.xlsx')
    if (!payment_methods) missing.push('payment_methods_report.xlsx')
    if (!items)           missing.push('items_report.xlsx')
    if (missing.length > 0) return apiError(`Missing required files: ${missing.join(', ')}`, 400)

    const parsed = parseIposUpload({ sale_summary, payment_methods, items, source })

    if (parsed.daily.rows.length === 0 && parsed.payments.rows.length === 0 && parsed.products.rows.length === 0) {
      return apiError('Parsed 0 rows from iPOS files; nothing to write', 400)
    }

    const supabase = createServiceClient()

    const dailyRows = buildDailyRows(storeId, parsed.daily.rows, parsed.payments.rows)
    const hourlyRows = buildHourlyRows(storeId, parsed.hourly.rows)
    const productRows = buildProductRows(storeId, parsed.products.rows)

    const writeErrors: string[] = []

    if (dailyRows.length > 0) {
      const { error } = await supabase
        .from('daily_sales')
        .upsert(dailyRows, { onConflict: 'store_id,date' })
      if (error) writeErrors.push(`daily_sales: ${error.message}`)
    }

    if (hourlyRows.length > 0) {
      const { error } = await supabase
        .from('hourly_sales')
        .upsert(hourlyRows, { onConflict: 'store_id,date,hour' })
      if (error) writeErrors.push(`hourly_sales: ${error.message}`)
    }

    if (productRows.length > 0) {
      const { error } = await supabase
        .from('product_sales')
        .upsert(productRows, { onConflict: 'store_id,date,product_name' })
      if (error) writeErrors.push(`product_sales: ${error.message}`)
    }

    // Audit trail.
    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: 'iPOS bundle (4 files)',
      file_type: 'ipos',
      record_count: dailyRows.length + hourlyRows.length + productRows.length,
      status: writeErrors.length === 0 ? 'success' : 'partial',
      error_details: writeErrors.length > 0 ? { errors: writeErrors } : null,
    })

    if (writeErrors.length > 0) {
      return apiError(`Partial write: ${writeErrors.join('; ')}`, 500)
    }

    return apiSuccess({
      storeId,
      detectedDateRange: parsed.detectedDateRange,
      written: {
        daily: dailyRows.length,
        hourly: hourlyRows.length,
        products: productRows.length,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error confirming iPOS upload'
    return apiError(msg, 500)
  }
}
