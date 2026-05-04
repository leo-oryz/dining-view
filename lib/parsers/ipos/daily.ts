// Parses sale_summary_report.xlsx → Sheet 0 "Doanh thu theo ngày" (Daily revenue).

import * as XLSX from 'xlsx'
import type { DailySalesRow, ParseResult } from './types'
import { computeDateRange, excelSerialToDate, toInt } from './utils'

export function parseDailySheet(buffer: ArrayBuffer): ParseResult<DailySalesRow> {
  const errors: string[] = []
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { rows: [], dateRange: { start: '', end: '' }, errors: ['sale_summary_report: no sheets found'] }
  }
  const sheet = wb.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][]

  const rows: DailySalesRow[] = []
  // First row is a header; we still iterate from index 0 and skip rows whose
  // first cell isn't a number (the iPOS header row has the label "Ngày").
  for (let i = 0; i < grid.length; i++) {
    const r = grid[i]
    if (!r || r.length === 0) continue
    const dateCell = r[0]
    if (typeof dateCell !== 'number') continue // header / blank / total

    const net = toInt(r[1])
    const invoices = toInt(r[2])
    const covers = toInt(r[3])
    if (net === 0 && invoices === 0 && covers === 0) continue // closed day

    rows.push({
      date: excelSerialToDate(dateCell),
      net_revenue: net,
      invoice_count: invoices,
      cover_count: covers,
    })
  }

  if (rows.length === 0) errors.push('sale_summary_report: no daily rows found')

  return {
    rows,
    dateRange: computeDateRange(rows.map(r => r.date)),
    errors,
  }
}
