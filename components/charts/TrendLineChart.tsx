'use client'

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  net_sales: number | null
  guests: number | null
  orders: number | null
}

interface TrendLineChartProps {
  data: DataPoint[]
  dailyTarget: number | null
  metric: 'net_sales' | 'guests' | 'orders'
  height?: number
}

const metricConfig = {
  net_sales: { label: '淨銷售額', color: '#3b82f6', format: (v: number) => `NT$${v.toLocaleString()}` },
  guests: { label: '來客數', color: '#8b5cf6', format: (v: number) => v.toLocaleString() },
  orders: { label: '訂單數', color: '#f59e0b', format: (v: number) => v.toLocaleString() },
}

export function TrendLineChart({ data, dailyTarget, metric, height }: TrendLineChartProps) {
  const config = metricConfig[metric]

  const chartData = data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      dateLabel: format(new Date(d.date), 'M/d'),
      value: d[metric] ?? 0,
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無銷售資料
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height ?? (typeof window !== 'undefined' && window.innerWidth < 640 ? 220 : 320)}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip
          formatter={(value) => [config.format(Number(value)), config.label]}
          labelFormatter={(label) => `日期: ${label}`}
        />
        <Legend />
        <Bar
          dataKey="value"
          name={config.label}
          fill={config.color}
          opacity={0.3}
          radius={[4, 4, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={config.label}
          stroke={config.color}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 5 }}
        />
        {dailyTarget != null && metric === 'net_sales' && (
          <ReferenceLine
            y={dailyTarget}
            stroke="#ef4444"
            strokeDasharray="6 4"
            strokeWidth={2}
            label={{ value: `日目標 NT$${dailyTarget.toLocaleString()}`, position: 'right', fontSize: 11, fill: '#ef4444' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
