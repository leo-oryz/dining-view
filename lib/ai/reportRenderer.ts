// Types for AI report JSON → UI component props

export interface AttributionReport {
  period: { from: string; to: string }
  summary: string
  anomalies: {
    date: string
    revenue_delta_pct: number
    likely_cause: string
    evidence: string
    confidence: 'high' | 'medium' | 'low'
  }[]
  top_drivers: {
    factor: string
    name: string
    impact_estimate: string
    evidence: string
  }[]
  recommendations: string[]
}

export interface StarProductsReport {
  period: { from: string; to: string }
  summary: string
  stars: {
    product_name: string
    category: string
    gross_margin: number
    qty_trend_pct: number
    basket_affinity: string[]
    anomaly_flag: 'spike' | 'drop' | 'none'
    recommendation: string
    evidence: string
  }[]
}

export interface RetireCandidatesReport {
  period: { from: string; to: string }
  summary: string
  candidates: {
    product_name: string
    category: string
    gross_margin: number
    qty_trend_pct: number
    basket_risk: string
    anomaly_flag: 'spike' | 'drop' | 'none'
    verdict: 'retire' | 'caution' | 'monitor'
    reason: string
    evidence: string
  }[]
}

export type ReportType = 'attribution' | 'star_products' | 'retire_candidates'

export interface ReportRecord {
  id: string
  report_type: ReportType
  report_date: string
  period_start: string | null
  period_end: string | null
  content: unknown
  model_used: string | null
  created_at: string
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

export function parseAttributionReport(content: unknown): AttributionReport | null {
  try {
    const c = content as AttributionReport
    if (!c.period || !c.summary) return null
    return {
      period: c.period,
      summary: c.summary,
      anomalies: Array.isArray(c.anomalies)
        ? c.anomalies.map((a) => ({
            ...a,
            revenue_delta_pct: toNum(a.revenue_delta_pct),
            confidence: (['high', 'medium', 'low'].includes(a.confidence) ? a.confidence : 'low') as 'high' | 'medium' | 'low',
          }))
        : [],
      top_drivers: Array.isArray(c.top_drivers) ? c.top_drivers : [],
      recommendations: Array.isArray(c.recommendations) ? c.recommendations : [],
    }
  } catch {
    return null
  }
}

export function parseStarProductsReport(content: unknown): StarProductsReport | null {
  try {
    const c = content as StarProductsReport
    if (!c.period || !c.summary) return null
    return {
      period: c.period,
      summary: c.summary,
      stars: Array.isArray(c.stars)
        ? c.stars.map((s) => ({
            ...s,
            gross_margin: toNum(s.gross_margin),
            qty_trend_pct: toNum(s.qty_trend_pct),
            basket_affinity: Array.isArray(s.basket_affinity) ? s.basket_affinity : [],
            anomaly_flag: (['spike', 'drop', 'none'].includes(s.anomaly_flag) ? s.anomaly_flag : 'none') as 'spike' | 'drop' | 'none',
          }))
        : [],
    }
  } catch {
    return null
  }
}

export function parseRetireCandidatesReport(content: unknown): RetireCandidatesReport | null {
  try {
    const c = content as RetireCandidatesReport
    if (!c.period || !c.summary) return null
    return {
      period: c.period,
      summary: c.summary,
      candidates: Array.isArray(c.candidates)
        ? c.candidates.map((d) => ({
            ...d,
            gross_margin: toNum(d.gross_margin),
            qty_trend_pct: toNum(d.qty_trend_pct),
            anomaly_flag: (['spike', 'drop', 'none'].includes(d.anomaly_flag) ? d.anomaly_flag : 'none') as 'spike' | 'drop' | 'none',
            verdict: (['retire', 'caution', 'monitor'].includes(d.verdict) ? d.verdict : 'monitor') as 'retire' | 'caution' | 'monitor',
          }))
        : [],
    }
  } catch {
    return null
  }
}
