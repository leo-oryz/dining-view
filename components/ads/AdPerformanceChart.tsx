'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

interface CorrelationRow {
  date: string
  ad_spend: number
  ad_clicks: number
  revenue: number | null
}

export default function AdPerformanceChart({ data }: { data: CorrelationRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-8">
        尚無廣告效果數據
      </div>
    )
  }

  const chartData = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      廣告花費: d.ad_spend,
      營收: d.revenue ?? undefined,
    }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickFormatter={(val) => format(new Date(val), 'M/d')}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <Tooltip
          labelFormatter={(val) => format(new Date(val as string), 'yyyy/M/d')}
          formatter={(val, name) => [`NT$ ${Number(val).toLocaleString()}`, name]}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="廣告花費" fill="#818cf8" barSize={20} />
        <Line yAxisId="right" type="monotone" dataKey="營收" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
