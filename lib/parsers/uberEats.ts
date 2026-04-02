import Papa from 'papaparse'
import type { ParseError } from './eat365Summary'

export interface UberEatsRow {
  date: string
  platform: 'ubereats'
  gross_revenue: number | null
  commission: number | null
  commission_rate: number | null
  net_revenue: number | null
  order_count: number | null
  avg_order_value: number | null
  cancellation_rate: number | null
  platform_rating: number | null
  data_source: 'csv'
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '').replace(/\$/g, '').trim()
  const num = Number(str)
  return isNaN(num) ? null : num
}

function parsePercent(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/%/g, '').replace(/,/g, '').trim()
  const num = Number(str)
  if (isNaN(num)) return null
  // If the value had a % sign or is > 1, treat as percentage
  return String(val).includes('%') ? num / 100 : (num > 1 ? num / 100 : num)
}

function normalizeDate(val: string): string | null {
  // Try YYYY-MM-DD first
  const iso = val.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]

  // Try YYYY/MM/DD
  const slash = val.match(/(\d{4})\/(\d{2})\/(\d{2})/)
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}`

  // Try MM/DD/YYYY or DD/MM/YYYY (assume MM/DD/YYYY)
  const mdy = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`

  const d = new Date(val)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

// Map common header variations to canonical field names
function mapHeader(header: string): string | null {
  const h = header.toLowerCase().trim()
  if (h.includes('date') || h === '日期') return 'date'
  if (h.includes('gross') || h.includes('總營收') || h.includes('gross revenue')) return 'gross_revenue'
  if (h.includes('commission') && h.includes('rate') || h.includes('佣金率')) return 'commission_rate'
  if (h.includes('commission') || h.includes('佣金')) return 'commission'
  if (h.includes('net') || h.includes('淨營收')) return 'net_revenue'
  if (h.includes('order') && h.includes('count') || h.includes('訂單數')) return 'order_count'
  if (h.includes('avg') || h.includes('average') || h.includes('平均')) return 'avg_order_value'
  if (h.includes('cancel') || h.includes('取消')) return 'cancellation_rate'
  if (h.includes('rating') || h.includes('評分')) return 'platform_rating'
  return null
}

export function parseUberEatsCsv(csvText: string): { data: UberEatsRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: UberEatsRow[] = []

  const result = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true })

  if (result.data.length < 2) {
    errors.push({ row: 0, field: '', message: 'File has too few rows. Expected header + data rows.' })
    return { data, errors }
  }

  // Build header mapping
  const headerRow = result.data[0]
  const fieldMap: Record<number, string> = {}
  for (let c = 0; c < headerRow.length; c++) {
    const mapped = mapHeader(headerRow[c])
    if (mapped) fieldMap[c] = mapped
  }

  if (!fieldMap || !Object.values(fieldMap).includes('date')) {
    errors.push({ row: 1, field: 'header', message: 'Could not find a date column in the header row.' })
    return { data, errors }
  }

  // Deduplicate by date
  const seen = new Set<string>()

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: Record<string, any> = {}

    for (const [colIdx, field] of Object.entries(fieldMap)) {
      rec[field] = row[Number(colIdx)]
    }

    if (!rec.date) {
      errors.push({ row: i + 1, field: 'date', message: 'Missing date value' })
      continue
    }

    const dateStr = normalizeDate(String(rec.date))
    if (!dateStr) {
      errors.push({ row: i + 1, field: 'date', message: `Invalid date: ${rec.date}` })
      continue
    }

    if (seen.has(dateStr)) continue
    seen.add(dateStr)

    const grossRevenue = parseNum(rec.gross_revenue)
    const commission = parseNum(rec.commission)
    const commissionRate = parsePercent(rec.commission_rate)
    const netRevenue = parseNum(rec.net_revenue) ??
      (grossRevenue !== null && commission !== null ? grossRevenue - commission : null)

    data.push({
      date: dateStr,
      platform: 'ubereats',
      gross_revenue: grossRevenue,
      commission,
      commission_rate: commissionRate,
      net_revenue: netRevenue,
      order_count: parseNum(rec.order_count) !== null ? Math.round(parseNum(rec.order_count)!) : null,
      avg_order_value: parseNum(rec.avg_order_value),
      cancellation_rate: parsePercent(rec.cancellation_rate),
      platform_rating: parseNum(rec.platform_rating),
      data_source: 'csv',
    })
  }

  return { data, errors }
}
