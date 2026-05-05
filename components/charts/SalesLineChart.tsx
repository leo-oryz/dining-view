'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  net_sales: number | null
  guests: number | null
}

interface SalesLineChartProps {
  data: DataPoint[]
  height?: number
  valueLabel?: string
  valuePrefix?: string
}

export function SalesLineChart({ data, height, valueLabel = '淨銷售額', valuePrefix = '₫' }: SalesLineChartProps) {
  const chartData = data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      dateLabel: format(new Date(d.date), 'M/d'),
      net_sales: d.net_sales ?? 0,
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無銷售資料
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height ?? (typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 300)}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip
          formatter={(value) => [`${valuePrefix}${Number(value).toLocaleString()}`, valueLabel]}
          labelFormatter={(label) => `日期: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="net_sales"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
