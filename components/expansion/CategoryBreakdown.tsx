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

interface CategoryData {
  category: string
  total_revenue: number
  total_qty: number
}

interface CategoryBreakdownProps {
  data: CategoryData[]
  height?: number
}

export function CategoryBreakdown({ data, height }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        尚無分類資料
      </div>
    )
  }

  const defaultHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 280

  return (
    <ResponsiveContainer width="100%" height={height ?? defaultHeight}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
        <Tooltip
          formatter={(value) => [`₫${Number(value).toLocaleString()}`, '營收']}
        />
        <Bar dataKey="total_revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
