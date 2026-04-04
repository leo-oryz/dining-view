'use client'

import { useEffect, useState, useMemo } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { WeekdayHeatmap } from '@/components/charts/WeekdayHeatmap'
import { KpiSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { DollarSign, Users, ShoppingCart, Target, TrendingUp } from 'lucide-react'
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, getDaysInMonth, differenceInCalendarDays, parseISO } from 'date-fns'
import { type WeatherDaily, getWeatherType, isRainy, buildWeatherMap } from '@/lib/weather/weatherUtils'

type RangeKey = '7d' | '30d' | '90d' | 'ytd' | 'last_month' | 'this_month' | 'custom'
type Metric = 'net_sales' | 'guests' | 'orders'

interface DailySales {
  date: string
  net_sales: number | null
  guests: number | null
  orders: number | null
  avg_spending: number | null
}

interface HourlyRecord {
  date: string
  hour: number
  net_sales: number | null
}

interface MonthlyTarget {
  month: string
  revenue_target: number
}

// Calculate the pro-rated target for a date range across multiple months
function calcRangeTarget(targets: MonthlyTarget[], rangeStart: string, rangeEnd: string): number | null {
  if (targets.length === 0) return null

  const targetMap: Record<string, number> = {}
  for (const t of targets) {
    // month is stored as YYYY-MM-DD (first of month)
    const key = t.month.slice(0, 7) // "2026-04"
    targetMap[key] = t.revenue_target
  }

  let total = 0
  let hasAny = false
  const start = parseISO(rangeStart)
  const end = parseISO(rangeEnd)

  // Iterate each month that overlaps the range
  let cursor = startOfMonth(start)
  while (cursor <= end) {
    const monthKey = format(cursor, 'yyyy-MM')
    const monthTarget = targetMap[monthKey]

    if (monthTarget != null && monthTarget > 0) {
      const monthStart = startOfMonth(cursor)
      const monthEnd = endOfMonth(cursor)
      const daysInThisMonth = getDaysInMonth(cursor)

      // Overlap: max(rangeStart, monthStart) to min(rangeEnd, monthEnd)
      const overlapStart = start > monthStart ? start : monthStart
      const overlapEnd = end < monthEnd ? end : monthEnd
      const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1

      if (overlapDays > 0) {
        total += (monthTarget / daysInThisMonth) * overlapDays
        hasAny = true
      }
    }

    // Move to next month
    const nextMonth = new Date(cursor)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    cursor = nextMonth
  }

  return hasAny ? total : null
}

export default function TrendsPage() {
  const [data, setData] = useState<DailySales[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyRecord[]>([])
  const [targets, setTargets] = useState<MonthlyTarget[]>([])
  const [weatherData, setWeatherData] = useState<WeatherDaily[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<Metric>('net_sales')
  const [heatmapWeatherFilter, setHeatmapWeatherFilter] = useState<'all' | 'sunny' | 'rainy'>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { startDate, endDate } = useMemo(() => {
    if (rangeKey === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd }
    }
    const today = new Date()
    if (rangeKey === 'ytd') {
      return {
        startDate: format(startOfYear(today), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }
    }
    if (rangeKey === 'this_month') {
      return {
        startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }
    }
    if (rangeKey === 'last_month') {
      const lastMonth = subMonths(today, 1)
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      }
    }
    const days = rangeKey === '7d' ? 7 : rangeKey === '90d' ? 90 : 30
    return {
      startDate: format(subDays(today, days), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
    }
  }, [rangeKey, customStart, customEnd])

  // Fetch daily + hourly + targets for the range
  useEffect(() => {
    setLoading(true)
    const params = `start_date=${startDate}&end_date=${endDate}`
    // Target months: need to cover all months in range
    const tStartMonth = format(startOfMonth(parseISO(startDate)), 'yyyy-MM-dd')
    const tEndMonth = format(startOfMonth(parseISO(endDate)), 'yyyy-MM-dd')

    Promise.all([
      fetch(`/api/sales/daily?${params}`).then((r) => r.json()),
      fetch(`/api/sales/hourly?${params}`).then((r) => r.json()),
      fetch(`/api/targets?start_month=${tStartMonth}&end_month=${tEndMonth}`).then((r) => r.json()),
      fetch(`/api/weather/range?from=${startDate}&to=${endDate}`).then((r) => r.json()).catch(() => ({ success: false })),
    ])
      .then(([dailyJson, hourlyJson, targetsJson, weatherJson]) => {
        if (dailyJson.success) setData(dailyJson.data || [])
        if (hourlyJson.success) setHourlyData(hourlyJson.data || [])
        if (targetsJson.success) setTargets(targetsJson.data || [])
        if (weatherJson.success) setWeatherData(weatherJson.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  // Compute KPIs
  const totalRevenue = data.reduce((sum, d) => sum + (d.net_sales ?? 0), 0)
  const totalGuests = data.reduce((sum, d) => sum + (d.guests ?? 0), 0)
  const totalOrders = data.reduce((sum, d) => sum + (d.orders ?? 0), 0)
  const daysWithData = data.filter((d) => d.net_sales != null).length
  const avgDaily = daysWithData > 0 ? totalRevenue / daysWithData : 0

  // Target achievement for the selected range
  const rangeTarget = calcRangeTarget(targets, startDate, endDate)
  const achievementPct = rangeTarget != null && rangeTarget > 0 ? (totalRevenue / rangeTarget) * 100 : null

  // Daily target for chart reference line (weighted average from targets in range)
  const totalDaysInRange = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
  const dailyTarget = rangeTarget != null && totalDaysInRange > 0 ? rangeTarget / totalDaysInRange : null

  // WoW comparison
  const halfLen = Math.floor(data.length / 2)
  const recentHalf = data.slice(0, halfLen)
  const olderHalf = data.slice(halfLen)
  const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((s, d) => s + (d.net_sales ?? 0), 0) / recentHalf.length : 0
  const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((s, d) => s + (d.net_sales ?? 0), 0) / olderHalf.length : 0
  const periodChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : null

  const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: '7d', label: '7 天' },
    { key: '30d', label: '30 天' },
    { key: '90d', label: '90 天' },
    { key: 'this_month', label: '這個月' },
    { key: 'last_month', label: '上個月' },
    { key: 'ytd', label: '今年至今' },
    { key: 'custom', label: '自訂' },
  ]

  const metricOptions: { key: Metric; label: string }[] = [
    { key: 'net_sales', label: '營收' },
    { key: 'guests', label: '來客數' },
    { key: 'orders', label: '訂單數' },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">趨勢分析</h1>
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRangeKey(opt.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                rangeKey === opt.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {rangeKey === 'custom' && (
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="期間總營收"
          value={`NT$${totalRevenue.toLocaleString()}`}
          change={periodChange}
          changeLabel="vs 前半期"
          icon={<DollarSign size={20} />}
        />
        <KpiCard
          title="日均營收"
          value={`NT$${Math.round(avgDaily).toLocaleString()}`}
          icon={<TrendingUp size={20} />}
        />
        <KpiCard
          title="期間來客數"
          value={totalGuests.toLocaleString()}
          icon={<Users size={20} />}
        />
        <KpiCard
          title="期間訂單數"
          value={totalOrders.toLocaleString()}
          icon={<ShoppingCart size={20} />}
        />
      </div>

      {/* Target Achievement Card */}
      {rangeTarget != null && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-900">目標達成率</h2>
            <span className="text-xs text-slate-400">
              {startDate} ~ {endDate}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-slate-900">
                NT${totalRevenue.toLocaleString()}
                <span className="text-sm font-normal text-slate-400 ml-2">
                  / NT${Math.round(rangeTarget).toLocaleString()}
                </span>
              </p>
              <p className={`text-lg font-semibold ${achievementPct != null && achievementPct >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                {achievementPct != null ? `${achievementPct.toFixed(1)}%` : '--'}
              </p>
            </div>
            {/* Progress bar */}
            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  achievementPct != null && achievementPct >= 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(achievementPct ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              日均目標 NT${dailyTarget != null ? Math.round(dailyTarget).toLocaleString() : '--'}
              {' · '}
              日均實際 NT${Math.round(avgDaily).toLocaleString()}
              {dailyTarget != null && dailyTarget > 0 && (
                <span className={avgDaily >= dailyTarget ? ' text-green-600' : ' text-red-500'}>
                  {' '}({avgDaily >= dailyTarget ? '+' : ''}{((avgDaily - dailyTarget) / dailyTarget * 100).toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* No target hint */}
      {rangeTarget == null && (
        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-4 text-center">
          <Target size={20} className="text-slate-400 mx-auto mb-1" />
          <p className="text-sm text-slate-500">
            尚未設定此區間的營收目標，請至
            <a href="/settings" className="text-blue-600 hover:underline mx-1">系統設定</a>
            設定年度目標
          </p>
        </div>
      )}

      {/* Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">趨勢走勢</h2>
          <div className="flex gap-1">
            {metricOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMetric(opt.key)}
                className={`px-2.5 py-1 text-xs rounded-md transition ${
                  metric === opt.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <TrendLineChart data={data} dailyTarget={dailyTarget} metric={metric} weatherData={weatherData} />
      </div>

      {/* Weekday × Hour Heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">
            週間 × 時段熱力圖
            <span className="text-xs font-normal text-slate-400 ml-2">平均營收</span>
          </h2>
          {weatherData.length > 0 && (
            <div className="flex gap-1">
              {([['all', '全部'], ['sunny', '☀️ 晴天'], ['rainy', '🌧 雨天']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setHeatmapWeatherFilter(key)}
                  className={`px-2.5 py-1 text-xs rounded-md transition ${
                    heatmapWeatherFilter === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <WeekdayHeatmap data={(() => {
          if (heatmapWeatherFilter === 'all' || weatherData.length === 0) return hourlyData
          const wMap = buildWeatherMap(weatherData)
          return hourlyData.filter(h => {
            const w = wMap.get(h.date)
            if (!w) return false
            if (heatmapWeatherFilter === 'rainy') return isRainy(w)
            // sunny = sunny + cloudy
            const type = getWeatherType(w)
            return type === 'sunny' || type === 'cloudy' || type === 'other'
          })
        })()} />
      </div>
    </div>
  )
}
