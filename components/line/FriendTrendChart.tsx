'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  broadcast_date: string
  friend_count_after: number | null
}

export default function FriendTrendChart({ data }: { data: DataPoint[] }) {
  const chartData = data
    .filter((d) => d.friend_count_after != null)
    .map((d) => ({
      date: d.broadcast_date,
      friends: d.friend_count_after,
    }))

  if (chartData.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-8">
        尚無好友數據
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          tickFormatter={(val) => format(new Date(val), 'M/d')}
        />
        <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <Tooltip
          labelFormatter={(val) => format(new Date(val as string), 'yyyy/M/d')}
          formatter={(val) => [Number(val).toLocaleString(), '好友數']}
        />
        <Line
          type="monotone"
          dataKey="friends"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
