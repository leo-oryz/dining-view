import * as XLSX from 'xlsx'
import type { ParseError } from './eat365Summary'

export interface HourlySalesRow {
  hour: number
  net_sales: number | null
  total_tendered: number | null
  transaction_count: number | null
  guest_count: number | null
  avg_sales: number | null
  quantity: number | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '').replace(/%/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

function parseHour(timeStr: string): number | null {
  // Format: "10:00 - 11:00" → 10
  const match = String(timeStr).match(/^(\d{1,2}):/)
  return match ? parseInt(match[1], 10) : null
}

export function parseEat365Hourly(buffer: ArrayBuffer): { data: HourlySalesRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: HourlySalesRow[] = []

  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    // Header at row 0, data from row 1
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue

      const timeVal = String(row[0]).trim()
      // Skip "Total" row
      if (timeVal.toLowerCase() === 'total') continue

      const hour = parseHour(timeVal)
      if (hour === null) {
        errors.push({ row: i + 1, field: 'Time', message: `Cannot parse hour from: ${timeVal}` })
        continue
      }

      data.push({
        hour,
        total_tendered: parseNum(row[1]),
        net_sales: parseNum(row[2]),
        // row[3] = Net Sales %
        transaction_count: parseNum(row[4]),
        // row[5] = Transaction Count %
        guest_count: parseNum(row[6]),
        avg_sales: parseNum(row[7]),
        quantity: parseNum(row[8]),
        // row[9] = Quantity %
      })
    }
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse xls: ${(e as Error).message}` })
  }

  return { data, errors }
}
