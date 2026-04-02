'use client'

import { RetireCandidatesReport as RetireData } from '@/lib/ai/reportRenderer'
import { AlertOctagon } from 'lucide-react'

const verdictConfig = {
  retire: { label: '建議下架', color: 'bg-red-100 text-red-800' },
  caution: { label: '需留意', color: 'bg-yellow-100 text-yellow-800' },
  monitor: { label: '持續觀察', color: 'bg-blue-100 text-blue-800' },
}

export default function RetireCandidatesReport({ data }: { data: RetireData }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-red-50 rounded-xl p-5">
        <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
        <p className="text-xs text-slate-400 mt-2">
          {data.period.from} ~ {data.period.to}
        </p>
      </div>

      {/* Candidates */}
      {data.candidates.length > 0 && (
        <div className="space-y-3">
          {data.candidates.map((c, i) => {
            const cfg = verdictConfig[c.verdict] || verdictConfig.monitor
            return (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon size={16} className="text-red-400" />
                    <span className="font-medium text-slate-900">{c.product_name}</span>
                    {c.category && (
                      <span className="text-xs text-slate-400">{c.category}</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-500">毛利率</p>
                    <p className="text-sm font-medium">{(c.gross_margin * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">銷量趨勢</p>
                    <p className={`text-sm font-medium ${c.qty_trend_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {c.qty_trend_pct >= 0 ? '+' : ''}{c.qty_trend_pct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs text-slate-500">連帶風險</p>
                    <p className="text-sm text-slate-700">{c.basket_risk}</p>
                  </div>
                </div>

                <p className="text-sm text-slate-700">{c.reason}</p>
                <p className="text-xs text-slate-500 mt-1">{c.evidence}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
