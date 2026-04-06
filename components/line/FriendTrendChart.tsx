'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  friends: number
  has_broadcast: boolean
}

export default function FriendTrendChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-8">
        尚無好友數據
      </div>
    )
  }

  const broadcastDates = data.filter(d => d.has_broadcast).map(d => d.date)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          tickFormatter={(val) => format(new Date(val), 'M/d')}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          domain={['dataMin - 50', 'dataMax + 50']}
        />
        <Tooltip
          labelFormatter={(val) => {
            const dateStr = format(new Date(val as string), 'yyyy/M/d')
            const point = data.find(d => d.date === val)
            return point?.has_broadcast ? `${dateStr}  (有推播)` : dateStr
          }}
          formatter={(val) => [Number(val).toLocaleString(), '好友數']}
        />
        {broadcastDates.map((d) => (
          <ReferenceLine
            key={d}
            x={d}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
        ))}
        <Line
          type="monotone"
          dataKey="friends"
          stroke="#22c55e"
          strokeWidth={2}
          dot={(props: Record<string, unknown>) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: DataPoint }
            if (payload?.has_broadcast) {
              return (
                <circle
                  key={`dot-${payload.date}`}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill="#f59e0b"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )
            }
            return (
              <circle
                key={`dot-${payload?.date}`}
                cx={cx}
                cy={cy}
                r={3}
                fill="#22c55e"
                stroke="#fff"
                strokeWidth={1}
              />
            )
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
