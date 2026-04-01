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

interface HourlyData {
  hour: number
  net_sales: number | null
  guest_count: number | null
  transaction_count: number | null
}

interface HourlyHeatmapProps {
  data: HourlyData[]
}

export function HourlyHeatmap({ data }: HourlyHeatmapProps) {
  const chartData = data
    .slice()
    .sort((a, b) => a.hour - b.hour)
    .map((d) => ({
      ...d,
      hourLabel: `${String(d.hour).padStart(2, '0')}:00`,
      net_sales: d.net_sales ?? 0,
      guest_count: d.guest_count ?? 0,
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無時段資料
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip
          formatter={(value) => {
            return [`NT$${Number(value).toLocaleString()}`, '淨銷售額']
          }}
        />
        <Bar dataKey="net_sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
