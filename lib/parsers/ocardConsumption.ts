import Papa from 'papaparse'
import type { ParseError } from './eat365Summary'

export interface OcardConsumptionData {
  spending_total: number | null
  spending_customers: number | null
  spending_transactions: number | null
  avg_ticket: number | null
  avg_frequency: number | null
  male_count: number | null
  female_count: number | null
  age_0_18: number | null
  age_19_25: number | null
  age_26_30: number | null
  age_31_35: number | null
  age_36_40: number | null
  age_41_50: number | null
  age_51_60: number | null
  age_60_plus: number | null
  vip_tier_1_count: number | null
  vip_tier_2_count: number | null
  vip_tier_3_count: number | null
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

export function parseOcardConsumption(csvText: string): { data: OcardConsumptionData; errors: ParseError[] } {
  const errors: ParseError[] = []
  const result: OcardConsumptionData = {
    spending_total: null, spending_customers: null, spending_transactions: null,
    avg_ticket: null, avg_frequency: null,
    male_count: null, female_count: null,
    age_0_18: null, age_19_25: null, age_26_30: null, age_31_35: null,
    age_36_40: null, age_41_50: null, age_51_60: null, age_60_plus: null,
    vip_tier_1_count: null, vip_tier_2_count: null, vip_tier_3_count: null,
    period_start: null, period_end: null,
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

    result.spending_total = parseNum(kvMap.get('期間消費額'))
    result.spending_customers = parseNum(kvMap.get('期間消費人數'))
    result.spending_transactions = parseNum(kvMap.get('期間消費次數'))
    result.avg_ticket = parseNum(kvMap.get('平均客單價'))
    result.avg_frequency = parseNum(kvMap.get('平均消費頻率'))

    result.male_count = parseNum(kvMap.get('男'))
    result.female_count = parseNum(kvMap.get('女'))

    result.age_0_18 = parseNum(kvMap.get('0-18歲'))
    result.age_19_25 = parseNum(kvMap.get('19-25歲'))
    result.age_26_30 = parseNum(kvMap.get('26-30歲'))
    result.age_31_35 = parseNum(kvMap.get('31-35歲'))
    result.age_36_40 = parseNum(kvMap.get('36-40歲'))
    result.age_41_50 = parseNum(kvMap.get('41-50歲'))
    result.age_51_60 = parseNum(kvMap.get('51-60歲'))
    result.age_60_plus = parseNum(kvMap.get('60歲以上'))

    // VIP tiers - based on sample data: 麵包學徒, 吐司職人, 咖啡老饕
    result.vip_tier_1_count = parseNum(kvMap.get('麵包學徒'))
    result.vip_tier_2_count = parseNum(kvMap.get('吐司職人'))
    result.vip_tier_3_count = parseNum(kvMap.get('咖啡老饕'))
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse consumption CSV: ${(e as Error).message}` })
  }

  return { data: result, errors }
}
