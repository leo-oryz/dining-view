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

interface TimeSlotData {
  hour: number
  avg_sales: number
  avg_guests: number
}

interface TimeSlotHeatmapProps {
  data: TimeSlotData[]
  height?: number
}

export function TimeSlotHeatmap({ data, height }: TimeSlotHeatmapProps) {
  const chartData = data
    .slice()
    .sort((a, b) => a.hour - b.hour)
    .map((d) => ({
      ...d,
      hourLabel: `${String(d.hour).padStart(2, '0')}:00`,
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        尚無時段資料
      </div>
    )
  }

  const defaultHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 280

  return (
    <ResponsiveContainer width="100%" height={height ?? defaultHeight}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip
          formatter={(value) => [`₫${Number(value).toLocaleString()}`, '平均營收']}
        />
        <Bar dataKey="avg_sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
