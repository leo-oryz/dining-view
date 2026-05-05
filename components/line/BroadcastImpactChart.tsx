'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

interface ImpactRow {
  broadcast_title: string
  broadcast_date: string
  avg_before: number
  d1_revenue: number | null
  d2_revenue: number | null
  d3_revenue: number | null
}

export default function BroadcastImpactChart({ data }: { data: ImpactRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-8">
        尚無推播效果數據
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: d.broadcast_title.length > 10 ? d.broadcast_title.slice(0, 10) + '...' : d.broadcast_title,
    基準營收: Math.round(d.avg_before),
    'D+1': d.d1_revenue ? Math.round(d.d1_revenue) : 0,
    'D+2': d.d2_revenue ? Math.round(d.d2_revenue) : 0,
    'D+3': d.d3_revenue ? Math.round(d.d3_revenue) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <Tooltip formatter={(val) => `₫ ${Number(val).toLocaleString()}`} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Bar dataKey="基準營收" fill="#cbd5e1" />
        <Bar dataKey="D+1" fill="#22c55e" />
        <Bar dataKey="D+2" fill="#16a34a" />
        <Bar dataKey="D+3" fill="#15803d" />
      </BarChart>
    </ResponsiveContainer>
  )
}
