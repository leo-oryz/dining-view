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
  age_19_22: number | null
  age_23_29: number | null
  age_30_39: number | null
  age_40_49: number | null
  age_50_59: number | null
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

export function parseOcardConsumption(csvText: string): { data: OcardConsumptionData; errors: ParseError[] } {
  const errors: ParseError[] = []
  const result: OcardConsumptionData = {
    spending_total: null, spending_customers: null, spending_transactions: null,
    avg_ticket: null, avg_frequency: null,
    male_count: null, female_count: null,
    age_0_18: null, age_19_22: null, age_23_29: null, age_30_39: null,
    age_40_49: null, age_50_59: null, age_60_plus: null,
    vip_tier_1_count: null, vip_tier_2_count: null, vip_tier_3_count: null,
    period_start: null, period_end: null,
  }

  try {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true })
    const rows = parsed.data as string[][]

    // Section-aware parsing
    let currentSection = 'header'
    const sectionData = new Map<string, Map<string, string>>()
    const globalKv = new Map<string, string>()

    for (const row of rows) {
      const col0 = String(row[0] || '').trim()
      const col1 = String(row[1] || '').trim()

      if (row.length < 2 || col1 === '' || col1.startsWith('----')) {
        if (col0.includes('性別')) currentSection = 'gender'
        else if (col0.includes('年齡')) currentSection = 'age'
        else if (col0.includes('VIP') && col0.includes('分析')) currentSection = 'vip'
        else if (col0.includes('管道')) currentSection = 'channel'
        else if (col0.includes('會員消費分析')) currentSection = 'vip_detail'
        else if (col0.includes('新舊客')) currentSection = 'retention'
        continue
      }

      // Skip table headers
      if (col1 === '人數' || col1 === '-------------------- #') continue

      if (!sectionData.has(currentSection)) sectionData.set(currentSection, new Map())
      sectionData.get(currentSection)!.set(col0, col1)
      globalKv.set(col0, col1)
    }

    const getVal = (section: string, key: string) => sectionData.get(section)?.get(key) ?? null
    const getGlobal = (key: string) => globalKv.get(key) ?? null

    // Period
    const startRaw = getGlobal('取樣開始日期')
    const endRaw = getGlobal('取樣結束日期')
    if (startRaw && endRaw) {
      const fmt = (d: string) => {
        const parts = d.split('/')
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
      result.period_start = fmt(startRaw)
      result.period_end = fmt(endRaw)
    }

    result.spending_total = parseNum(getGlobal('期間消費額'))
    result.spending_customers = parseNum(getGlobal('期間消費人數'))
    result.spending_transactions = parseNum(getGlobal('期間消費次數'))
    result.avg_ticket = parseNum(getGlobal('平均客單價'))
    result.avg_frequency = parseNum(getGlobal('平均消費頻率'))

    // Gender
    result.male_count = parseNum(getVal('gender', '男性'))
    result.female_count = parseNum(getVal('gender', '女性'))

    // Age
    result.age_0_18 = parseNum(getVal('age', '0歲 - 18歲'))
    result.age_19_22 = parseNum(getVal('age', '19歲 - 22歲'))
    result.age_23_29 = parseNum(getVal('age', '23歲 - 29歲'))
    result.age_30_39 = parseNum(getVal('age', '30歲 - 39歲'))
    result.age_40_49 = parseNum(getVal('age', '40歲 - 49歲'))
    result.age_50_59 = parseNum(getVal('age', '50歲 - 59歲'))
    result.age_60_plus = parseNum(getVal('age', '60歲以上'))

    // VIP tiers
    result.vip_tier_1_count = parseNum(getVal('vip', '麵包學徒'))
    result.vip_tier_2_count = parseNum(getVal('vip', '吐司職人'))
    result.vip_tier_3_count = parseNum(getVal('vip', '咖啡老饕'))
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse consumption CSV: ${(e as Error).message}` })
  }

  return { data: result, errors }
}
