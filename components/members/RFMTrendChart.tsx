'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { format } from 'date-fns'

interface RFMSnapshot {
  snapshot_date: string
  gold_count: number | null
  regular_count: number | null
  dormant_count: number | null
}

interface Props {
  data: RFMSnapshot[]
}

export default function RFMTrendChart({ data }: Props) {
  const chartData = data.map(d => ({
    date: format(new Date(d.snapshot_date), 'M/d'),
    gold: Number(d.gold_count) || 0,
    regular: Number(d.regular_count) || 0,
    dormant: Number(d.dormant_count) || 0,
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無 RFM 趨勢資料
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="gold" name="金牌會員" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="regular" name="一般會員" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="dormant" name="沉睡會員" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
