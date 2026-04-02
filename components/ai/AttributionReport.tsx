'use client'

import { AttributionReport as AttributionData } from '@/lib/ai/reportRenderer'
import { AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react'

const confidenceColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-slate-100 text-slate-600',
}

const factorLabels: Record<string, string> = {
  campaign: '活動',
  weather: '天氣',
  competitor: '競品',
  line_broadcast: 'LINE 推播',
  ads: '廣告',
}

export default function AttributionReport({ data }: { data: AttributionData }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-purple-50 rounded-xl p-5">
        <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
        <p className="text-xs text-slate-400 mt-2">
          {data.period.from} ~ {data.period.to}
        </p>
      </div>

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-500" />
            異常偵測
          </h4>
          <div className="space-y-3">
            {data.anomalies.map((a, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900">{a.date}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${a.revenue_delta_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {a.revenue_delta_pct >= 0 ? '+' : ''}{a.revenue_delta_pct.toFixed(1)}%
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[a.confidence]}`}>
                      {a.confidence}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-700">{a.likely_cause}</p>
                <p className="text-xs text-slate-500 mt-1">{a.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Drivers */}
      {data.top_drivers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            主要驅動因素
          </h4>
          <div className="space-y-2">
            {data.top_drivers.map((d, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {factorLabels[d.factor] || d.factor}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{d.name}</span>
                </div>
                <p className="text-sm text-slate-600">{d.impact_estimate}</p>
                <p className="text-xs text-slate-500 mt-1">{d.evidence}</p>
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
            建議
          </h4>
          <ul className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-500 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
