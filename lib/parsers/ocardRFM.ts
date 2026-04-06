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
  r_distribution: Record<string, number> | null
  f_distribution: Record<string, number> | null
  m_distribution: Record<string, number> | null
  period_start: string | null
  period_end: string | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '').replace(/%/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

export function parseOcardRFM(csvText: string): { data: OcardRFMData; errors: ParseError[] } {
  const errors: ParseError[] = []
  const result: OcardRFMData = {
    total_customers: null, avg_ticket: null, total_contribution: null,
    avg_days_since_visit: null, gold_count: null, regular_count: null,
    dormant_count: null, r_distribution: null, f_distribution: null,
    m_distribution: null, period_start: null, period_end: null,
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

      // Detect section headers
      if (row.length < 2 || col1 === '' || col1.startsWith('----')) {
        if (col0.includes('顧客類型人數')) currentSection = 'rfm_segment'
        else if (col0.match(/^R-.*分析$/) && !col0.includes('交叉')) currentSection = 'r_dist'
        else if (col0.match(/^F-.*分析$/) && !col0.includes('交叉')) currentSection = 'f_dist'
        else if (col0.match(/^M-.*分析$/) && !col0.includes('交叉')) currentSection = 'm_dist'
        else if (col0.includes('交叉')) currentSection = 'cross' // skip cross-analysis tables
        else if (col0.includes('顧客類型分析')) currentSection = 'rfm_pct' // skip percentage table
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

    result.total_customers = parseNum(getGlobal('期間消費人數'))
    result.avg_ticket = parseNum(getGlobal('平均客單價'))
    result.total_contribution = parseNum(getGlobal('顧客總貢獻'))
    result.avg_days_since_visit = parseNum(getGlobal('平均最後到訪天數'))

    // RFM segments
    result.gold_count = parseNum(getVal('rfm_segment', '黃金客'))
    result.regular_count = parseNum(getVal('rfm_segment', '一般客'))
    result.dormant_count = parseNum(getVal('rfm_segment', '沉睡客'))

    // R/F/M distributions — convert section maps to Record<string, number>
    const toDistribution = (section: string): Record<string, number> | null => {
      const map = sectionData.get(section)
      if (!map || map.size === 0) return null
      const dist: Record<string, number> = {}
      Array.from(map.entries()).forEach(([key, val]) => {
        const num = parseNum(val)
        if (num !== null) dist[key] = num
      })
      return Object.keys(dist).length > 0 ? dist : null
    }

    result.r_distribution = toDistribution('r_dist')
    result.f_distribution = toDistribution('f_dist')
    result.m_distribution = toDistribution('m_dist')
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse RFM CSV: ${(e as Error).message}` })
  }

  return { data: result, errors }
}
