// Parses source_report.xlsx (TẠI CHỖ / dine-in only). Optional supplement to
// sale_summary that adds gross_revenue and discount_amount per day.
//
// Header layout (skip header rows; rows whose first cell isn't a DD/MM/YYYY string
// are treated as headers/totals):
//   1  Ngày             DD/MM/YYYY
//   2  Số hoá đơn       invoice_count
//   3  Số khách         cover_count
//   4  Giảm giá         discount_amount
//   5  Doanh thu (net)  net_revenue
//   6  Doanh thu (gross) gross_revenue

import * as XLSX from 'xlsx'
import type { ParseResult, SourceRow } from './types'
import { computeDateRange, parseVietnameseDate, toInt } from './utils'

export function parseSourceReport(buffer: ArrayBuffer): ParseResult<SourceRow> {
  const errors: string[] = []
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { rows: [], dateRange: { start: '', end: '' }, errors: ['source_report: no sheets found'] }
  }
  const sheet = wb.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][]

  const rows: SourceRow[] = []
  for (let i = 0; i < grid.length; i++) {
    const r = grid[i]
    if (!r || r.length === 0) continue
    const dateCell = r[0]
    if (typeof dateCell !== 'string') continue
    const iso = parseVietnameseDate(dateCell)
    if (!iso) continue

    rows.push({
      date: iso,
      invoice_count: toInt(r[1]),
      cover_count: toInt(r[2]),
      discount_amount: toInt(r[3]),
      net_revenue: toInt(r[4]),
      gross_revenue: toInt(r[5]),
    })
  }

  return {
    rows,
    dateRange: computeDateRange(rows.map(r => r.date)),
    errors,
  }
}
