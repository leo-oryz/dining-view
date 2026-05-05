'use client'

interface ExpansionReportData {
  period: { from: string; to: string }
  summary: string
  strengths: string[]
  risks: string[]
  optimal_format: string
  target_demographic: string
  recommended_hours: string
  revenue_benchmark: {
    daily_avg: number
    per_seat_daily: number
  }
  recommendations: string[]
}

interface ExpansionReportProps {
  data: ExpansionReportData
}

export function ExpansionReport({ data }: ExpansionReportProps) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-1">展店準備度摘要</h4>
        <p className="text-sm text-blue-800">{data.summary}</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">建議型態</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">{data.optimal_format}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">目標客群</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">{data.target_demographic}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">建議營業時段</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">{data.recommended_hours}</div>
        </div>
      </div>

      {/* Revenue benchmark */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-xs text-green-700">日均營收基準</div>
          <div className="text-lg font-bold text-green-900 mt-1">
            ₫{data.revenue_benchmark.daily_avg?.toLocaleString() || '--'}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-xs text-green-700">每席位日均營收</div>
          <div className="text-lg font-bold text-green-900 mt-1">
            ₫{data.revenue_benchmark.per_seat_daily?.toLocaleString() || '--'}
          </div>
        </div>
      </div>

      {/* Strengths & Risks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-green-700 mb-2">優勢</h4>
          <ul className="space-y-1">
            {data.strengths.map((s, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-green-500 shrink-0">+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2">風險</h4>
          <ul className="space-y-1">
            {data.risks.map((r, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-red-500 shrink-0">!</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-2">建議行動</h4>
        <ol className="space-y-1 list-decimal list-inside">
          {data.recommendations.map((r, i) => (
            <li key={i} className="text-sm text-slate-700">{r}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
