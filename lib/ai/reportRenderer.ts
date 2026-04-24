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

export interface LaborCostReport {
  period: { from: string; to: string }
  summary: string
  headline_metrics: {
    avg_cost_ratio: number
    target_ratio: number
    revenue_per_salary: number
    trend: 'improving' | 'stable' | 'worsening'
    months_analyzed: string[]
  }
  department_insights: {
    department: string
    payroll_share_pct: number
    concern: 'over-indexed' | 'under-indexed' | 'balanced'
    observation: string
  }[]
  overtime_analysis: {
    total_ot_hours: number
    ot_ratio_pct: number
    ot_premium_estimate: number
    top_concerns: {
      name: string
      ot_hours: number
      implication: string
    }[]
    assessment: string
  }
  employment_mix: {
    ft_share_pct: number
    pt_share_pct: number
    assessment: 'healthy' | 'too-rigid' | 'too-fluid'
    observation: string
  }
  anomalies: {
    category: 'ratio' | 'department' | 'overtime' | 'individual_pay'
    severity: 'high' | 'medium' | 'low'
    description: string
    evidence: string
  }[]
  recommendations: {
    priority: 'high' | 'medium' | 'low'
    action: string
    expected_impact: string
  }[]
}

export type ReportType = 'attribution' | 'star_products' | 'retire_candidates' | 'labor_cost'

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

export function parseLaborCostReport(content: unknown): LaborCostReport | null {
  try {
    const c = content as LaborCostReport
    if (!c.period || !c.summary || !c.headline_metrics) return null
    const validTrend = ['improving', 'stable', 'worsening'] as const
    const validConcern = ['over-indexed', 'under-indexed', 'balanced'] as const
    const validMix = ['healthy', 'too-rigid', 'too-fluid'] as const
    const validSev = ['high', 'medium', 'low'] as const
    const validCat = ['ratio', 'department', 'overtime', 'individual_pay'] as const
    return {
      period: c.period,
      summary: c.summary,
      headline_metrics: {
        avg_cost_ratio: toNum(c.headline_metrics.avg_cost_ratio),
        target_ratio: toNum(c.headline_metrics.target_ratio, 0.3),
        revenue_per_salary: toNum(c.headline_metrics.revenue_per_salary),
        trend: (validTrend as readonly string[]).includes(c.headline_metrics.trend)
          ? c.headline_metrics.trend : 'stable',
        months_analyzed: Array.isArray(c.headline_metrics.months_analyzed) ? c.headline_metrics.months_analyzed : [],
      },
      department_insights: Array.isArray(c.department_insights)
        ? c.department_insights.map(d => ({
            ...d,
            payroll_share_pct: toNum(d.payroll_share_pct),
            concern: (validConcern as readonly string[]).includes(d.concern) ? d.concern : 'balanced',
          }))
        : [],
      overtime_analysis: c.overtime_analysis ? {
        total_ot_hours: toNum(c.overtime_analysis.total_ot_hours),
        ot_ratio_pct: toNum(c.overtime_analysis.ot_ratio_pct),
        ot_premium_estimate: toNum(c.overtime_analysis.ot_premium_estimate),
        top_concerns: Array.isArray(c.overtime_analysis.top_concerns)
          ? c.overtime_analysis.top_concerns.map(t => ({ ...t, ot_hours: toNum(t.ot_hours) })) : [],
        assessment: c.overtime_analysis.assessment || '',
      } : { total_ot_hours: 0, ot_ratio_pct: 0, ot_premium_estimate: 0, top_concerns: [], assessment: '' },
      employment_mix: c.employment_mix ? {
        ft_share_pct: toNum(c.employment_mix.ft_share_pct),
        pt_share_pct: toNum(c.employment_mix.pt_share_pct),
        assessment: (validMix as readonly string[]).includes(c.employment_mix.assessment)
          ? c.employment_mix.assessment : 'healthy',
        observation: c.employment_mix.observation || '',
      } : { ft_share_pct: 0, pt_share_pct: 0, assessment: 'healthy', observation: '' },
      anomalies: Array.isArray(c.anomalies)
        ? c.anomalies.map(a => ({
            ...a,
            category: (validCat as readonly string[]).includes(a.category) ? a.category : 'ratio',
            severity: (validSev as readonly string[]).includes(a.severity) ? a.severity : 'low',
          }))
        : [],
      recommendations: Array.isArray(c.recommendations)
        ? c.recommendations.map(r => ({
            ...r,
            priority: (validSev as readonly string[]).includes(r.priority) ? r.priority : 'medium',
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
