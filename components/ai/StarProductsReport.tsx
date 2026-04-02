'use client'

import { StarProductsReport as StarData } from '@/lib/ai/reportRenderer'
import { Star } from 'lucide-react'

export default function StarProductsReport({ data }: { data: StarData }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-amber-50 rounded-xl p-5">
        <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
        <p className="text-xs text-slate-400 mt-2">
          {data.period.from} ~ {data.period.to}
        </p>
      </div>

      {/* Stars table */}
      {data.stars.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-500 font-medium">商品</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">分類</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">毛利率</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">銷量趨勢</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium hidden md:table-cell">搭配商品</th>
              </tr>
            </thead>
            <tbody>
              {data.stars.map((s, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="font-medium text-slate-900">{s.product_name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.recommendation}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{s.category || '-'}</td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-600">
                    {(s.gross_margin * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={s.qty_trend_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {s.qty_trend_pct >= 0 ? '+' : ''}{s.qty_trend_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {s.basket_affinity.slice(0, 3).map((b, j) => (
                        <span key={j} className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
