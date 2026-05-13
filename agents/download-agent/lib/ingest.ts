import type { SupabaseClient } from '@supabase/supabase-js'
import { parseIposUpload } from '../../../lib/parsers/ipos'
import type {
  DailySalesRow,
  HourlySalesRow,
  PaymentRow,
  ProductSalesRow,
} from '../../../lib/parsers/ipos/types'
import { log } from './log'
import type { IposDownloadResult } from './ipos-scraper'

// Mirrors app/api/upload/ipos/confirm/route.ts. We deliberately keep this in
// the agent (instead of HTTP-posting to the Next.js endpoint) so the agent
// works even when the deploy is asleep — same pattern as sync_weather.ts and
// sync_reviews.ts.
function buildDailyRows(
  storeId: string,
  daily: DailySalesRow[],
  payments: PaymentRow[],
) {
  const paymentMap = new Map(payments.map(p => [p.date, p]))
  const dailyMap = new Map(daily.map(d => [d.date, d]))
  const allDates = new Set<string>([...dailyMap.keys(), ...paymentMap.keys()])
  const rows = []
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
      orders: d?.invoice_count ?? 0,
      guests: d?.cover_count ?? 0,
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
    net_sales: r.net_revenue,
    invoice_count: r.invoice_count,
    transaction_count: r.invoice_count,
    cover_count: r.cover_count,
    guest_count: r.cover_count,
  }))
}

function buildProductRows(storeId: string, rows: ProductSalesRow[]) {
  return rows.map(r => ({
    store_id: storeId,
    date: r.date,
    sku_id: r.sku_id,
    sku_name: r.sku_name,
    product_name: r.sku_name,
    product_code: r.sku_id,
    unit: r.unit,
    category: r.category,
    item_type: r.item_type,
    product_type: r.item_type,
    quantity_sold: r.quantity_sold,
    net_revenue: r.net_revenue,
    revenue: r.net_revenue,
    gross_revenue: r.gross_revenue,
    discount_amount: r.discount_amount,
    avg_price: r.avg_price,
    price: r.avg_price,
  }))
}

export interface IngestReport {
  storeId: string
  detectedDateRange: { start: string; end: string }
  written: { daily: number; hourly: number; products: number }
  parseErrors: string[]
  writeErrors: string[]
}

export async function ingestIposDownload(
  supabase: SupabaseClient,
  storeId: string,
  files: IposDownloadResult,
): Promise<IngestReport> {
  const required = ['sale_summary', 'payment_methods', 'items'] as const
  const missing = required.filter(k => !files[k])
  if (missing.length > 0) {
    return {
      storeId,
      detectedDateRange: files.range,
      written: { daily: 0, hourly: 0, products: 0 },
      parseErrors: [`Missing required downloads: ${missing.join(', ')}`],
      writeErrors: [],
    }
  }

  const parsed = parseIposUpload({
    sale_summary: files.sale_summary!,
    payment_methods: files.payment_methods!,
    items: files.items!,
    source: files.source ?? undefined,
  })

  const dailyRows = buildDailyRows(storeId, parsed.daily.rows, parsed.payments.rows)
  const hourlyRows = buildHourlyRows(storeId, parsed.hourly.rows)
  const productRows = buildProductRows(storeId, parsed.products.rows)

  const writeErrors: string[] = []

  if (dailyRows.length > 0) {
    const { error } = await supabase.from('daily_sales').upsert(dailyRows, { onConflict: 'store_id,date' })
    if (error) writeErrors.push(`daily_sales: ${error.message}`)
  }
  if (hourlyRows.length > 0) {
    const { error } = await supabase.from('hourly_sales').upsert(hourlyRows, { onConflict: 'store_id,date,hour' })
    if (error) writeErrors.push(`hourly_sales: ${error.message}`)
  }
  if (productRows.length > 0) {
    const { error } = await supabase.from('product_sales').upsert(productRows, { onConflict: 'store_id,date,product_name' })
    if (error) writeErrors.push(`product_sales: ${error.message}`)
  }

  await supabase.from('upload_history').insert({
    store_id: storeId,
    file_name: 'iPOS scraped (Playwright)',
    file_type: 'ipos',
    record_count: dailyRows.length + hourlyRows.length + productRows.length,
    status: writeErrors.length === 0 ? 'success' : 'partial',
    error_details: writeErrors.length > 0 ? { errors: writeErrors } : null,
  })

  log.info(`store=${storeId}: wrote daily=${dailyRows.length} hourly=${hourlyRows.length} products=${productRows.length}`)

  return {
    storeId,
    detectedDateRange: parsed.detectedDateRange,
    written: {
      daily: dailyRows.length,
      hourly: hourlyRows.length,
      products: productRows.length,
    },
    parseErrors: parsed.errors,
    writeErrors,
  }
}
