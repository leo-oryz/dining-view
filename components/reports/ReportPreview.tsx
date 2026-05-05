'use client'

interface MonthlyRevenue {
  month: string
  revenue: number
}

interface TopProduct {
  product_name: string
  total_revenue: number
  total_quantity: number
}

interface PreviewData {
  monthly_revenue: MonthlyRevenue[]
  top_products: TopProduct[]
  gross_margin: number | null
  kpis: {
    avg_spend: number
    turnover_rate: number
    new_member_rate: number
  }
}

interface Props {
  data: PreviewData | null
}

export default function ReportPreview({ data }: Props) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Revenue preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">月營收趨勢 (最近 12 個月)</h4>
        {data.monthly_revenue.length > 0 ? (
          <div className="space-y-2">
            {data.monthly_revenue.map(r => (
              <div key={r.month} className="flex justify-between text-sm">
                <span className="text-slate-500">{r.month}</span>
                <span className="font-medium text-slate-900">₫{Math.round(r.revenue).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">無營收資料</p>
        )}
      </div>

      {/* Top products preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Top 10 產品</h4>
        {data.top_products.length > 0 ? (
          <div className="space-y-2">
            {data.top_products.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600">{i + 1}. {p.product_name}</span>
                <span className="font-medium text-slate-900">₫{Math.round(p.total_revenue).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">無產品資料</p>
        )}
      </div>

      {/* KPIs preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">關鍵指標</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">平均客單價</span>
            <p className="font-semibold text-slate-900">₫{data.kpis.avg_spend.toFixed(0)}</p>
          </div>
          <div>
            <span className="text-slate-500">翻桌率</span>
            <p className="font-semibold text-slate-900">{data.kpis.turnover_rate.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-slate-500">新會員率</span>
            <p className="font-semibold text-slate-900">{(data.kpis.new_member_rate * 100).toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-slate-500">整體毛利率</span>
            <p className="font-semibold text-slate-900">
              {data.gross_margin != null ? `${(data.gross_margin * 100).toFixed(1)}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
