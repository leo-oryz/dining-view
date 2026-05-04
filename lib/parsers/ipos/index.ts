// Orchestrator — runs all 4 iPOS parsers and merges source_report into the daily rows.

import { parseDailySheet } from './daily'
import { parseHourlySheet } from './hourly'
import { parsePaymentMethods } from './payment'
import { parseItemsReport } from './product'
import { parseSourceReport } from './source'
import type {
  DailySalesRow,
  DateRange,
  HourlySalesRow,
  ParseResult,
  PaymentRow,
  ProductSalesRow,
  SourceRow,
} from './types'

export interface IposBuffers {
  sale_summary?: ArrayBuffer
  payment_methods?: ArrayBuffer
  items?: ArrayBuffer
  source?: ArrayBuffer
}

export interface IposParseOutput {
  daily: ParseResult<DailySalesRow>
  hourly: ParseResult<HourlySalesRow>
  payments: ParseResult<PaymentRow>
  products: ParseResult<ProductSalesRow>
  source: ParseResult<SourceRow>
  detectedDateRange: DateRange
  errors: string[]
}

function unionRange(...ranges: DateRange[]): DateRange {
  const dates = ranges.flatMap(r => (r.start && r.end ? [r.start, r.end] : []))
  if (dates.length === 0) return { start: '', end: '' }
  const sorted = [...dates].sort()
  return { start: sorted[0], end: sorted[sorted.length - 1] }
}

export function parseIposUpload(files: IposBuffers): IposParseOutput {
  const errors: string[] = []

  // Daily — required.
  const daily = files.sale_summary
    ? parseDailySheet(files.sale_summary)
    : emptyResult<DailySalesRow>('sale_summary_report.xlsx is required')

  // Detect range from daily first; payment + product can broaden it.
  const payments = files.payment_methods
    ? parsePaymentMethods(files.payment_methods)
    : emptyResult<PaymentRow>('payment_methods_report.xlsx is required')

  const products = files.items
    ? parseItemsReport(files.items)
    : emptyResult<ProductSalesRow>('items_report.xlsx is required')

  const source = files.source
    ? parseSourceReport(files.source)
    : { rows: [], dateRange: { start: '', end: '' }, errors: [] as string[] }

  const detectedDateRange = unionRange(
    daily.dateRange,
    payments.dateRange,
    products.dateRange,
    source.dateRange,
  )

  // Hourly — needs target date and span hint.
  const spansMultipleDays =
    !!detectedDateRange.start &&
    !!detectedDateRange.end &&
    detectedDateRange.start !== detectedDateRange.end
  const hourlyTargetDate = detectedDateRange.start || ''
  const hourly = files.sale_summary
    ? parseHourlySheet(files.sale_summary, hourlyTargetDate, spansMultipleDays)
    : emptyResult<HourlySalesRow>('sale_summary_report.xlsx is required')

  // Merge source data into daily rows (source supplies gross_revenue + discount_amount).
  if (source.rows.length > 0) {
    const sourceByDate = new Map(source.rows.map(s => [s.date, s]))
    for (const d of daily.rows) {
      const s = sourceByDate.get(d.date)
      if (!s) continue
      d.gross_revenue = s.gross_revenue
      d.discount_amount = s.discount_amount
    }
  }

  // Hoist parser-level errors so the API can surface them in one place.
  for (const r of [daily, hourly, payments, products, source]) {
    errors.push(...r.errors)
  }

  return { daily, hourly, payments, products, source, detectedDateRange, errors }
}

function emptyResult<T>(errMsg: string): ParseResult<T> {
  return { rows: [], dateRange: { start: '', end: '' }, errors: [errMsg] }
}

export type {
  DailySalesRow,
  HourlySalesRow,
  PaymentRow,
  ProductSalesRow,
  SourceRow,
  DateRange,
  ParseResult,
} from './types'
