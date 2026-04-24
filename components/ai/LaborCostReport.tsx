'use client'

import { LaborCostReport as LaborData } from '@/lib/ai/reportRenderer'
import { AlertTriangle, Lightbulb, TrendingUp, TrendingDown, Minus, Users, DollarSign, Clock } from 'lucide-react'

const trendConfig = {
  improving: { icon: TrendingDown, color: 'text-emerald-600', label: '成本率下降（變好）' },
  stable: { icon: Minus, color: 'text-slate-600', label: '穩定' },
  worsening: { icon: TrendingUp, color: 'text-red-600', label: '成本率上升（變差）' },
}

const severityColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
}

const priorityColors = {
  high: 'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
  low: 'bg-slate-50 border-slate-200',
}

const concernColors = {
  'over-indexed': 'bg-red-100 text-red-700 border-red-200',
  'under-indexed': 'bg-blue-100 text-blue-700 border-blue-200',
  balanced: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const concernLabels = {
  'over-indexed': '成本偏高',
  'under-indexed': '成本偏低',
  balanced: '平衡',
}

const mixLabels = {
  healthy: '健康',
  'too-rigid': '過度僵化（PT 太少）',
  'too-fluid': '過度依賴兼職（PT 太多）',
}

const mixColors = {
  healthy: 'bg-emerald-100 text-emerald-700',
  'too-rigid': 'bg-amber-100 text-amber-700',
  'too-fluid': 'bg-amber-100 text-amber-700',
}

const categoryLabels = {
  ratio: '成本率',
  department: '部門',
  overtime: '加班',
  individual_pay: '個別薪資',
}

const fmtNT = (v: number) => `NT$${Math.round(v).toLocaleString()}`
const fmtPct = (v: number) => `${v.toFixed(1)}%`

export default function LaborCostReport({ data }: { data: LaborData }) {
  const TrendIcon = trendConfig[data.headline_metrics.trend].icon
  const overTarget = data.headline_metrics.avg_cost_ratio > data.headline_metrics.target_ratio

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-purple-50 rounded-xl p-5">
        <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
        <p className="text-xs text-slate-400 mt-2">
          {data.period.from} ~ {data.period.to}
          {data.headline_metrics.months_analyzed.length > 0 && (
            <span> · 涵蓋 {data.headline_metrics.months_analyzed.join(', ')}</span>
          )}
        </p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <DollarSign size={14} className="text-amber-500" />
            平均成本率
          </div>
          <div className={`text-2xl font-bold ${overTarget ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmtPct(data.headline_metrics.avg_cost_ratio * 100)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            目標 {fmtPct(data.headline_metrics.target_ratio * 100)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendIcon size={14} className={trendConfig[data.headline_metrics.trend].color} />
            趨勢
          </div>
          <div className={`text-lg font-semibold ${trendConfig[data.headline_metrics.trend].color}`}>
            {trendConfig[data.headline_metrics.trend].label}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingUp size={14} className="text-blue-500" />
            每元薪資產生營收
          </div>
          <div className="text-2xl font-bold text-slate-900">
            NT${data.headline_metrics.revenue_per_salary.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Department insights */}
      {data.department_insights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            部門成本分析
          </h4>
          <div className="space-y-3">
            {data.department_insights.map((d, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{d.department}</span>
                    <span className="text-sm text-slate-500">佔薪資 {fmtPct(d.payroll_share_pct)}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${concernColors[d.concern]}`}>
                    {concernLabels[d.concern]}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{d.observation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overtime analysis */}
      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Clock size={16} className="text-orange-500" />
          加班分析
        </h4>
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-slate-500">OT 總時數：</span>
              <span className="font-semibold text-slate-900">{data.overtime_analysis.total_ot_hours}h</span>
            </div>
            <div>
              <span className="text-slate-500">OT 佔總工時：</span>
              <span className={`font-semibold ${data.overtime_analysis.ot_ratio_pct > 10 ? 'text-red-600' : 'text-slate-900'}`}>
                {fmtPct(data.overtime_analysis.ot_ratio_pct)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">OT 溢價估計：</span>
              <span className="font-semibold text-slate-900">{fmtNT(data.overtime_analysis.ot_premium_estimate)}</span>
            </div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{data.overtime_analysis.assessment}</p>
          {data.overtime_analysis.top_concerns.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-2">重點關注：</div>
              <ul className="space-y-2">
                {data.overtime_analysis.top_concerns.map((c, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="text-orange-600 ml-2">OT {c.ot_hours}h</span>
                    <span className="text-slate-600 block ml-0 mt-0.5">{c.implication}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Employment mix */}
      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">雇用結構</h4>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <span>正職 <span className="font-semibold text-slate-900">{fmtPct(data.employment_mix.ft_share_pct)}</span></span>
              <span>兼職 <span className="font-semibold text-slate-900">{fmtPct(data.employment_mix.pt_share_pct)}</span></span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${mixColors[data.employment_mix.assessment]}`}>
              {mixLabels[data.employment_mix.assessment]}
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{data.employment_mix.observation}</p>
        </div>
      </div>

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-500" />
            異常與關注點
          </h4>
          <div className="space-y-2">
            {data.anomalies.map((a, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-slate-500">{categoryLabels[a.category]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${severityColors[a.severity]}`}>
                    {a.severity === 'high' ? '高' : a.severity === 'medium' ? '中' : '低'}
                  </span>
                </div>
                <p className="text-sm text-slate-900 font-medium">{a.description}</p>
                <p className="text-xs text-slate-500 mt-1">{a.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" />
            建議行動
          </h4>
          <div className="space-y-2">
            {data.recommendations.map((r, i) => (
              <div key={i} className={`rounded-lg border p-4 ${priorityColors[r.priority]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500">優先級</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${severityColors[r.priority]}`}>
                    {r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低'}
                  </span>
                </div>
                <p className="text-sm text-slate-900 font-medium">{r.action}</p>
                <p className="text-xs text-slate-600 mt-1">{r.expected_impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
