import Papa from 'papaparse'
import type { ParseError } from './eat365Summary'

export interface OcardRFMData {
  total_customers: number | null
  avg_ticket: number | null
  total_contribution: number | null
  avg_days_since_visit: number | null
  gold_count: number | null
  regular_count: number | null
  dormant_count: number | null
  period_start: string | null
  period_end: string | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '').replace(/%/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

function parsePeriod(text: string): { start: string | null; end: string | null } {
  const match = text.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s*-\s*(\d{4}\/\d{1,2}\/\d{1,2})/)
  if (!match) return { start: null, end: null }
  const formatDate = (d: string) => {
    const parts = d.split('/')
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  }
  return { start: formatDate(match[1]), end: formatDate(match[2]) }
}

export function parseOcardRFM(csvText: string): { data: OcardRFMData; errors: ParseError[] } {
  const errors: ParseError[] = []
  const result: OcardRFMData = {
    total_customers: null, avg_ticket: null, total_contribution: null,
    avg_days_since_visit: null, gold_count: null, regular_count: null,
    dormant_count: null, period_start: null, period_end: null,
  }

  try {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true })
    const rows = parsed.data as string[][]

    const kvMap = new Map<string, string>()
    for (const row of rows) {
      if (row.length >= 2) {
        kvMap.set(String(row[0]).trim(), String(row[1]).trim())
      }
    }

    // Extract period
    for (const row of rows) {
      const val = String(row[0] || '') + ' ' + String(row[1] || '')
      const period = parsePeriod(val)
      if (period.start) {
        result.period_start = period.start
        result.period_end = period.end
        break
      }
    }

    result.total_customers = parseNum(kvMap.get('期間消費人數'))
    result.avg_ticket = parseNum(kvMap.get('平均客單價'))
    result.total_contribution = parseNum(kvMap.get('顧客總貢獻'))
    result.avg_days_since_visit = parseNum(kvMap.get('平均最後到訪天數'))

    // RFM segments
    result.gold_count = parseNum(kvMap.get('黃金客'))
    result.regular_count = parseNum(kvMap.get('一般客'))
    result.dormant_count = parseNum(kvMap.get('沉睡客'))
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse RFM CSV: ${(e as Error).message}` })
  }

  return { data: result, errors }
}
