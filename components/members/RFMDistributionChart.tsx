'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> | null
  color: string
}

export default function RFMDistributionChart({ title, data, color }: Props) {
  if (!data || typeof data !== 'object') {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        尚無分佈資料
      </div>
    )
  }

  const chartData = Object.entries(data).map(([key, value]) => ({
    label: key,
    count: Number(value) || 0,
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        尚無分佈資料
      </div>
    )
  }

  return (
    <div>
      <h5 className="text-sm font-medium text-slate-700 mb-2">{title}</h5>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip />
          <Bar dataKey="count" name="人數" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
