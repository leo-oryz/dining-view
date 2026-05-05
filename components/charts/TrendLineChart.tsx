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

export interface HolidayMarker {
  date: string
  country_code: string
  name: string
  type: string
}

export interface FlightWeek {
  week_start: string
  flight_count: number
  wow_change_pct: number | null
}

interface TrendLineChartProps {
  data: DataPoint[]
  dailyTarget: number | null
  metric: 'net_sales' | 'guests' | 'orders' | 'avg_spending' | 'turnover'
  height?: number
  weatherData?: WeatherDaily[]
  holidays?: HolidayMarker[]
  flightWeeks?: FlightWeek[]
  showHolidays?: boolean
  showFlights?: boolean
}

// Country group → marker color
const VN_COUNTRIES = new Set(['VN'])
const EAST_ASIA = new Set(['CN', 'KR', 'TW', 'HK'])
const SE_ASIA = new Set(['TH', 'SG', 'MY', 'PH'])
const FLIGHT_SPIKE_THRESHOLD = 15

function holidayColor(countryCode: string): string {
  if (VN_COUNTRIES.has(countryCode)) return '#ef4444' // red
  if (EAST_ASIA.has(countryCode)) return '#3b82f6' // blue
  if (SE_ASIA.has(countryCode)) return '#10b981' // green
  return '#94a3b8' // slate fallback
}

const metricConfig = {
  net_sales: { label: '淨銷售額', color: '#3b82f6', format: (v: number) => `₫${v.toLocaleString()}` },
  guests: { label: '來客數', color: '#8b5cf6', format: (v: number) => v.toLocaleString() },
  orders: { label: '訂單數', color: '#f59e0b', format: (v: number) => v.toLocaleString() },
  avg_spending: { label: '客單價', color: '#10b981', format: (v: number) => `₫${v.toLocaleString()}` },
  turnover: { label: '內用翻桌率', color: '#ec4899', format: (v: number) => `${v.toFixed(2)} 輪` },
}

export function TrendLineChart({
  data,
  dailyTarget,
  metric,
  height,
  weatherData,
  holidays,
  flightWeeks,
  showHolidays = true,
  showFlights = true,
}: TrendLineChartProps) {
  const config = metricConfig[metric]

  // Build weather lookup
  const weatherMap = new Map<string, WeatherDaily>()
  if (weatherData) {
    for (const w of weatherData) weatherMap.set(w.date, w)
  }

  // Group holidays by date for markers (multiple countries can share a date)
  const holidaysByDate = new Map<string, HolidayMarker[]>()
  if (showHolidays && holidays) {
    for (const h of holidays) {
      const existing = holidaysByDate.get(h.date) ?? []
      existing.push(h)
      holidaysByDate.set(h.date, existing)
    }
  }

  // Build a map of date -> flight count + spike flag, by snapping each date
  // to its containing week_start
  const flightByDate = new Map<string, { count: number; spike: boolean }>()
  if (showFlights && flightWeeks && flightWeeks.length > 0) {
    const weekTotals = new Map<string, { count: number; spike: boolean }>()
    for (const w of flightWeeks) {
      const prev = weekTotals.get(w.week_start) ?? { count: 0, spike: false }
      weekTotals.set(w.week_start, {
        count: prev.count + (w.flight_count ?? 0),
        spike:
          prev.spike ||
          (w.wow_change_pct != null && w.wow_change_pct > FLIGHT_SPIKE_THRESHOLD),
      })
    }
    for (const [weekStart, agg] of weekTotals.entries()) {
      const start = new Date(`${weekStart}T00:00:00Z`)
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setUTCDate(d.getUTCDate() + i)
        flightByDate.set(d.toISOString().slice(0, 10), agg)
      }
    }
  }

  const chartData = data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const w = weatherMap.get(d.date)
      // Preserve null for turnover so chart breaks the line on days without
      // channel data instead of plotting a misleading 0.
      const raw = d[metric]
      const value = metric === 'turnover' ? (raw ?? null) : (raw ?? 0)
      const flight = flightByDate.get(d.date)
      return {
        ...d,
        dateLabel: format(new Date(d.date), 'M/d'),
        value,
        precipitation: w?.precipitation ?? null,
        temp_high: w?.temp_high ?? null,
        flight_count: flight ? flight.count : null,
        flight_spike: flight ? flight.spike : false,
      }
    })

  // Find typhoon day labels for vertical reference lines
  const typhoonDays = chartData.filter((d) => {
    const w = weatherMap.get(d.date)
    return w && isTyphoon(w)
  })

  const hasWeather = weatherData && weatherData.length > 0
  const hasFlights = showFlights && flightByDate.size > 0
  const hasHolidayMarkers = showHolidays && holidaysByDate.size > 0
  const hasRightAxis = hasWeather || hasFlights

  // Pick which dateLabels in the visible chart range get holiday markers
  const holidayMarkers: { dateLabel: string; date: string; entries: HolidayMarker[] }[] = []
  if (hasHolidayMarkers) {
    const seen = new Set<string>()
    for (const point of chartData) {
      const entries = holidaysByDate.get(point.date)
      if (entries && entries.length > 0 && !seen.has(point.dateLabel)) {
        seen.add(point.dateLabel)
        holidayMarkers.push({ dateLabel: point.dateLabel, date: point.date, entries })
      }
    }
  }

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
        {hasRightAxis && (
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        )}
        <Tooltip
          formatter={(value, name) => {
            if (name === '降雨量') return [`${value}mm`, name]
            if (name === '最高溫') return [`${value}°C`, name]
            if (name === 'Flight capacity') return [Number(value).toLocaleString(), name]
            return [config.format(Number(value)), config.label]
          }}
          labelFormatter={(label, payload) => {
            const entry = payload?.[0]?.payload
            const w = entry?.date ? weatherMap.get(entry.date) : null
            const hList = entry?.date ? holidaysByDate.get(entry.date) : null
            const parts: string[] = [String(label)]
            if (w) {
              const type = getWeatherType(w)
              parts.push(`${getWeatherIcon(type)} ${WEATHER_LABELS[type]}`)
            }
            if (hList && hList.length > 0) {
              parts.push(...hList.map((h) => `${h.country_code} — ${h.name} (${h.type})`))
            }
            return parts.join('  ·  ')
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
            label={{ value: `日目標 ₫${dailyTarget.toLocaleString()}`, position: 'right', fontSize: 11, fill: '#ef4444' }}
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
        {hasFlights && (
          <Bar
            yAxisId="right"
            dataKey="flight_count"
            name="Flight capacity"
            opacity={0.5}
            radius={[2, 2, 0, 0]}
            shape={(props: unknown) => {
              const p = props as { x: number; y: number; width: number; height: number; payload?: { flight_spike?: boolean } }
              const isSpike = !!p.payload?.flight_spike
              return (
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={p.height}
                  rx={2}
                  ry={2}
                  fill={isSpike ? '#f59e0b' : '#cbd5e1'}
                  opacity={isSpike ? 0.7 : 0.4}
                />
              )
            }}
          />
        )}
        {holidayMarkers.map((m) => {
          const primary = m.entries[0]
          return (
            <ReferenceLine
              key={`holiday-${m.date}`}
              yAxisId="left"
              x={m.dateLabel}
              stroke={holidayColor(primary.country_code)}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: '🎉',
                position: 'top',
                fontSize: 11,
              }}
            />
          )
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
