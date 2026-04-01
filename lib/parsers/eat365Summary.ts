import * as XLSX from 'xlsx'

export interface ParseError {
  row: number
  field: string
  message: string
}

export interface DailySalesRow {
  date: string
  revenue: number | null
  net_sales: number | null
  service_charge: number | null
  delivery_fee: number | null
  discount_amount: number | null
  refund: number | null
  pre_order_deposit: number | null
  pre_order_deposit_refund: number | null
  gift_card_refund: number | null
  rounding_differences: number | null
  tips: number | null
  guests: number | null
  avg_spending: number | null
  table_turnover_rate: number | null
  cash_amount: number | null
  card_amount: number | null
  total_tendered: number | null
  is_weekend: boolean
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 || day === 6
}

export function parseEat365Summary(buffer: ArrayBuffer): { data: DailySalesRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: DailySalesRow[] = []

  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    // Row 0-2: metadata, Row 3: header, Row 4+: data
    if (rows.length < 5) {
      errors.push({ row: 0, field: '', message: 'File has too few rows. Expected data at row 5.' })
      return { data, errors }
    }

    // Data rows start at index 4
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue

      const dateVal = row[0]
      let dateStr: string

      if (typeof dateVal === 'number') {
        // Excel serial date
        const parsed = XLSX.SSF.parse_date_code(dateVal)
        dateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      } else {
        // Format: "2026-03-31 (Tue)" or "2026-03-31"
        const dateMatch = String(dateVal).match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) {
          dateStr = dateMatch[1]
        } else {
          const d = new Date(String(dateVal))
          if (isNaN(d.getTime())) {
            errors.push({ row: i + 1, field: 'Date', message: `Invalid date: ${dateVal}` })
            continue
          }
          dateStr = d.toISOString().split('T')[0]
        }
      }

      data.push({
        date: dateStr,
        revenue: parseNum(row[1]),
        service_charge: parseNum(row[2]),
        delivery_fee: parseNum(row[3]),
        discount_amount: parseNum(row[4]),
        refund: parseNum(row[5]),
        net_sales: parseNum(row[6]),
        pre_order_deposit: parseNum(row[7]),
        pre_order_deposit_refund: parseNum(row[8]),
        gift_card_refund: parseNum(row[9]),
        rounding_differences: parseNum(row[10]),
        tips: parseNum(row[11]),
        guests: parseNum(row[12]),
        avg_spending: parseNum(row[13]),
        table_turnover_rate: parseNum(row[14]),
        // Tender columns: Cash Qty(15), Cash NT$(16), Credit Qty(17), Credit NT$(18), Total Tendered(19+)
        cash_amount: parseNum(row[16]),
        card_amount: parseNum(row[18]),
        total_tendered: parseNum(row[19]) ?? parseNum(row[20]),
        is_weekend: isWeekend(dateStr),
      })
    }
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse xlsx: ${(e as Error).message}` })
  }

  return { data, errors }
}
