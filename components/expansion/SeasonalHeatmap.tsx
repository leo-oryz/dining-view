'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MonthlyData {
  month: string // YYYY-MM
  total_revenue: number
}

interface SeasonalHeatmapProps {
  data: MonthlyData[]
  height?: number
}

export function SeasonalHeatmap({ data, height }: SeasonalHeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        尚無月度資料
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.month.slice(5) + '月', // "01月"
  }))

  const defaultHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 280

  return (
    <ResponsiveContainer width="100%" height={height ?? defaultHeight}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip
          formatter={(value) => [`₫${Number(value).toLocaleString()}`, '月營收']}
        />
        <Bar dataKey="total_revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
