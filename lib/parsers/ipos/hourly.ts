// Parses sale_summary_report.xlsx → Sheet index 2 "Doanh thu theo giờ" (Hourly revenue).
// Hourly data is aggregated across the entire export window. Caller passes
// `targetDate` (typically dateRange.start) — every row is tagged with it,
// and a warning is added if the export spans multiple days.

import * as XLSX from 'xlsx'
import type { HourlySalesRow, ParseResult } from './types'
import { parseHourSlot, toInt } from './utils'

export function parseHourlySheet(
  buffer: ArrayBuffer,
  targetDate: string,
  exportSpansMultipleDays: boolean,
): ParseResult<HourlySalesRow> {
  const errors: string[] = []
  const warnings: string[] = []
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[2]
  if (!sheetName) {
    return {
      rows: [],
      dateRange: { start: targetDate, end: targetDate },
      errors: ['sale_summary_report: hourly sheet (index 2) not found'],
    }
  }
  const sheet = wb.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][]

  const rows: HourlySalesRow[] = []
  for (let i = 0; i < grid.length; i++) {
    const r = grid[i]
    if (!r || r.length === 0) continue
    const slotCell = r[0]
    if (typeof slotCell !== 'string') continue
    const hour = parseHourSlot(slotCell)
    if (hour === null) continue

    const net = toInt(r[1])
    const invoices = toInt(r[2])
    const covers = toInt(r[3])
    if (net === 0 && invoices === 0 && covers === 0) continue

    rows.push({
      date: targetDate,
      hour,
      net_revenue: net,
      invoice_count: invoices,
      cover_count: covers,
    })
  }

  if (exportSpansMultipleDays && rows.length > 0) {
    warnings.push(
      `Hourly data is aggregated across the entire export window — all hourly rows have been tagged to ${targetDate} (the start of the range).`,
    )
  }

  return {
    rows,
    dateRange: { start: targetDate, end: targetDate },
    errors,
    warnings,
  }
}
