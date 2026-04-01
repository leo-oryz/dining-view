'use client'

import { useEffect, useState } from 'react'
import { HourlyHeatmap } from '@/components/charts/HourlyHeatmap'
import { format } from 'date-fns'

interface HourlySalesData {
  hour: number
  net_sales: number | null
  guest_count: number | null
  transaction_count: number | null
}

export default function HeatmapPage() {
  const [data, setData] = useState<HourlySalesData[]>([])
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/sales/hourly?date=${date}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [date])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          時段銷售分布 — {date}
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            載入中...
          </div>
        ) : (
          <HourlyHeatmap data={data} />
        )}
      </div>

      {/* Summary table */}
      {data.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">時段明細</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500">時段</th>
                  <th className="text-right py-2 px-2 text-slate-500">淨銷售額</th>
                  <th className="text-right py-2 px-2 text-slate-500">交易數</th>
                  <th className="text-right py-2 px-2 text-slate-500">來客數</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.hour} className="border-b border-slate-100">
                    <td className="py-2 px-2">{String(row.hour).padStart(2, '0')}:00</td>
                    <td className="py-2 px-2 text-right">
                      {row.net_sales != null ? `NT$${row.net_sales.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2 px-2 text-right">{row.transaction_count ?? '-'}</td>
                    <td className="py-2 px-2 text-right">{row.guest_count ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
