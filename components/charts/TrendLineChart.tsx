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
import { type WeatherDaily, isTyphoon, getWeatherIcon, getWeatherType, WEATHER_LABELS } from '@/lib/weather/weatherUtils'

interface DataPoint {
  date: string
  net_sales: number | null
  guests: number | null
  orders: number | null
  avg_spending: number | null
  turnover?: number | null
}

interface TrendLineChartProps {
  data: DataPoint[]
  dailyTarget: number | null
  metric: 'net_sales' | 'guests' | 'orders' | 'avg_spending' | 'turnover'
  height?: number
  weatherData?: WeatherDaily[]
}

const metricConfig = {
  net_sales: { label: '淨銷售額', color: '#3b82f6', format: (v: number) => `NT$${v.toLocaleString()}` },
  guests: { label: '來客數', color: '#8b5cf6', format: (v: number) => v.toLocaleString() },
  orders: { label: '訂單數', color: '#f59e0b', format: (v: number) => v.toLocaleString() },
  avg_spending: { label: '客單價', color: '#10b981', format: (v: number) => `NT$${v.toLocaleString()}` },
  turnover: { label: '內用翻桌率', color: '#ec4899', format: (v: number) => `${v.toFixed(2)} 輪` },
}

export function TrendLineChart({ data, dailyTarget, metric, height, weatherData }: TrendLineChartProps) {
  const config = metricConfig[metric]

  // Build weather lookup
  const weatherMap = new Map<string, WeatherDaily>()
  if (weatherData) {
    for (const w of weatherData) weatherMap.set(w.date, w)
  }

  const chartData = data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const w = weatherMap.get(d.date)
      return {
        ...d,
        dateLabel: format(new Date(d.date), 'M/d'),
        value: d[metric] ?? 0,
        precipitation: w?.precipitation ?? null,
        temp_high: w?.temp_high ?? null,
      }
    })

  // Find typhoon day labels for vertical reference lines
  const typhoonDays = chartData.filter((d) => {
    const w = weatherMap.get(d.date)
    return w && isTyphoon(w)
  })

  const hasWeather = weatherData && weatherData.length > 0

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
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        {hasWeather && (
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        )}
        <Tooltip
          formatter={(value, name) => {
            if (name === '降雨量') return [`${value}mm`, name]
            if (name === '最高溫') return [`${value}°C`, name]
            return [config.format(Number(value)), config.label]
          }}
          labelFormatter={(label, payload) => {
            const entry = payload?.[0]?.payload
            const w = entry?.date ? weatherMap.get(entry.date) : null
            if (w) {
              const type = getWeatherType(w)
              return `${label}  ${getWeatherIcon(type)} ${WEATHER_LABELS[type]}`
            }
            return `日期: ${label}`
          }}
        />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="value"
          name={config.label}
          fill={config.color}
          opacity={0.3}
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="value"
          name={config.label}
          stroke={config.color}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 5 }}
        />
        {hasWeather && (
          <Bar
            yAxisId="right"
            dataKey="precipitation"
            name="降雨量"
            fill="#93c5fd"
            opacity={0.4}
            radius={[2, 2, 0, 0]}
          />
        )}
        {hasWeather && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="temp_high"
            name="最高溫"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
        {dailyTarget != null && metric === 'net_sales' && (
          <ReferenceLine
            yAxisId="left"
            y={dailyTarget}
            stroke="#ef4444"
            strokeDasharray="6 4"
            strokeWidth={2}
            label={{ value: `日目標 NT$${dailyTarget.toLocaleString()}`, position: 'right', fontSize: 11, fill: '#ef4444' }}
          />
        )}
        {typhoonDays.map((d) => (
          <ReferenceLine
            key={d.date}
            yAxisId="left"
            x={d.dateLabel}
            stroke="#ef4444"
            strokeWidth={2}
            label={{ value: '颱風', position: 'top', fontSize: 11, fill: '#ef4444' }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
