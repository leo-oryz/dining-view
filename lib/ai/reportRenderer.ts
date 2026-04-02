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

export function parseAttributionReport(content: unknown): AttributionReport | null {
  try {
    const c = content as AttributionReport
    if (!c.period || !c.summary) return null
    return {
      period: c.period,
      summary: c.summary,
      anomalies: Array.isArray(c.anomalies) ? c.anomalies : [],
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
      stars: Array.isArray(c.stars) ? c.stars : [],
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
      candidates: Array.isArray(c.candidates) ? c.candidates : [],
    }
  } catch {
    return null
  }
}
