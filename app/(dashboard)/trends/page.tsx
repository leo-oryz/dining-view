'use client'

import { useEffect, useState, useMemo } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { WeekdayHeatmap } from '@/components/charts/WeekdayHeatmap'
import { KpiSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { DollarSign, Users, ShoppingCart, Target, TrendingUp, Receipt, UtensilsCrossed, ShoppingBag } from 'lucide-react'
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, getDaysInMonth, differenceInCalendarDays, parseISO } from 'date-fns'
import { type WeatherDaily, getWeatherType, isRainy, buildWeatherMap } from '@/lib/weather/weatherUtils'
import { useI18n } from '@/lib/i18n/context'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type RangeKey = '7d' | '30d' | '90d' | 'ytd' | 'last_month' | 'this_month' | 'custom'
type Metric = 'net_sales' | 'guests' | 'orders' | 'avg_spending'
type TabKey = 'sales' | 'channel'

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

interface ChannelSummary {
  order_count: number
  revenue: number
  avg_spend: number
  order_pct: number
  revenue_pct: number
}

interface ChannelData {
  summary: { dine_in: ChannelSummary; takeout: ChannelSummary }
  daily: { date: string; dine_in_orders: number; takeout_orders: number; dine_in_revenue: number; takeout_revenue: number }[]
  hourly: { hour: number; dine_in_orders: number; takeout_orders: number }[]
}

// Calculate the pro-rated target for a date range across multiple months
function calcRangeTarget(targets: MonthlyTarget[], rangeStart: string, rangeEnd: string): number | null {
  if (targets.length === 0) return null

  const targetMap: Record<string, number> = {}
  for (const t of targets) {
    const key = t.month.slice(0, 7)
    targetMap[key] = t.revenue_target
  }

  let total = 0
  let hasAny = false
  const start = parseISO(rangeStart)
  const end = parseISO(rangeEnd)

  let cursor = startOfMonth(start)
  while (cursor <= end) {
    const monthKey = format(cursor, 'yyyy-MM')
    const monthTarget = targetMap[monthKey]

    if (monthTarget != null && monthTarget > 0) {
      const monthStart = startOfMonth(cursor)
      const monthEnd = endOfMonth(cursor)
      const daysInThisMonth = getDaysInMonth(cursor)

      const overlapStart = start > monthStart ? start : monthStart
      const overlapEnd = end < monthEnd ? end : monthEnd
      const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1

      if (overlapDays > 0) {
        total += (monthTarget / daysInThisMonth) * overlapDays
        hasAny = true
      }
    }

    const nextMonth = new Date(cursor)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    cursor = nextMonth
  }

  return hasAny ? total : null
}

export default function TrendsPage() {
  const { t } = useI18n()
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
  const [activeTab, setActiveTab] = useState<TabKey>('sales')
  const [channelData, setChannelData] = useState<ChannelData | null>(null)

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

  const { prevStartDate, prevEndDate, changeLabel } = useMemo(() => {
    const s = parseISO(startDate)
    const e = parseISO(endDate)
    const days = differenceInCalendarDays(e, s) + 1

    if (rangeKey === 'ytd') {
      return {
        prevStartDate: format(subYears(s, 1), 'yyyy-MM-dd'),
        prevEndDate: format(subYears(e, 1), 'yyyy-MM-dd'),
        changeLabel: t('trends.vsLastYear'),
      }
    }
    if (rangeKey === 'last_month') {
      const prevMonth = subMonths(s, 1)
      return {
        prevStartDate: format(startOfMonth(prevMonth), 'yyyy-MM-dd'),
        prevEndDate: format(endOfMonth(prevMonth), 'yyyy-MM-dd'),
        changeLabel: t('trends.vsPrevMonth'),
      }
    }
    if (rangeKey === 'this_month') {
      return {
        prevStartDate: format(subMonths(s, 1), 'yyyy-MM-dd'),
        prevEndDate: format(subMonths(e, 1), 'yyyy-MM-dd'),
        changeLabel: t('trends.vsLastMonthSame'),
      }
    }
    const labelMap: Record<string, string> = { '7d': t('trends.vsPrev7'), '30d': t('trends.vsPrev30'), '90d': t('trends.vsPrev90') }
    return {
      prevStartDate: format(subDays(s, days), 'yyyy-MM-dd'),
      prevEndDate: format(subDays(s, 1), 'yyyy-MM-dd'),
      changeLabel: labelMap[rangeKey] || t('trends.vsPrevPeriod'),
    }
  }, [startDate, endDate, rangeKey, t])

  const [prevData, setPrevData] = useState<DailySales[]>([])

  useEffect(() => {
    setLoading(true)
    const params = `start_date=${startDate}&end_date=${endDate}`
    const prevParams = `start_date=${prevStartDate}&end_date=${prevEndDate}`
    const tStartMonth = format(startOfMonth(parseISO(startDate)), 'yyyy-MM-dd')
    const tEndMonth = format(startOfMonth(parseISO(endDate)), 'yyyy-MM-dd')

    Promise.all([
      fetch(`/api/sales/daily?${params}`).then((r) => r.json()),
      fetch(`/api/sales/hourly?${params}`).then((r) => r.json()),
      fetch(`/api/targets?start_month=${tStartMonth}&end_month=${tEndMonth}`).then((r) => r.json()),
      fetch(`/api/weather/range?from=${startDate}&to=${endDate}`).then((r) => r.json()).catch(() => ({ success: false })),
      fetch(`/api/sales/daily?${prevParams}`).then((r) => r.json()),
      fetch(`/api/sales/channel-split?start_date=${startDate}&end_date=${endDate}`).then((r) => r.json()).catch(() => ({ success: false })),
    ])
      .then(([dailyJson, hourlyJson, targetsJson, weatherJson, prevJson, channelJson]) => {
        if (dailyJson.success) setData(dailyJson.data || [])
        if (hourlyJson.success) setHourlyData(hourlyJson.data || [])
        if (targetsJson.success) setTargets(targetsJson.data || [])
        if (weatherJson.success) setWeatherData(weatherJson.data || [])
        if (prevJson.success) setPrevData(prevJson.data || [])
        if (channelJson.success) setChannelData(channelJson.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [startDate, endDate, prevStartDate, prevEndDate])

  // Compute KPIs — current period
  const totalRevenue = data.reduce((sum, d) => sum + (d.net_sales ?? 0), 0)
  const totalGuests = data.reduce((sum, d) => sum + (d.guests ?? 0), 0)
  const totalOrders = data.reduce((sum, d) => sum + (d.orders ?? 0), 0)
  const daysWithData = data.filter((d) => d.net_sales != null).length
  const avgDaily = daysWithData > 0 ? totalRevenue / daysWithData : 0
  const avgSpending = totalGuests > 0 ? totalRevenue / totalGuests : 0

  // Compute KPIs — previous period
  const prevRevenue = prevData.reduce((sum, d) => sum + (d.net_sales ?? 0), 0)
  const prevGuests = prevData.reduce((sum, d) => sum + (d.guests ?? 0), 0)
  const prevOrders = prevData.reduce((sum, d) => sum + (d.orders ?? 0), 0)
  const prevDaysWithData = prevData.filter((d) => d.net_sales != null).length
  const prevAvgDaily = prevDaysWithData > 0 ? prevRevenue / prevDaysWithData : 0
  const prevAvgSpending = prevGuests > 0 ? prevRevenue / prevGuests : 0

  const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : null
  const revenueChange = pctChange(totalRevenue, prevRevenue)
  const avgDailyChange = pctChange(avgDaily, prevAvgDaily)
  const guestsChange = pctChange(totalGuests, prevGuests)
  const ordersChange = pctChange(totalOrders, prevOrders)
  const avgSpendingChange = pctChange(avgSpending, prevAvgSpending)

  const rangeTarget = calcRangeTarget(targets, startDate, endDate)
  const achievementPct = rangeTarget != null && rangeTarget > 0 ? (totalRevenue / rangeTarget) * 100 : null

  const totalDaysInRange = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
  const dailyTarget = rangeTarget != null && totalDaysInRange > 0 ? rangeTarget / totalDaysInRange : null

  const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: '7d', label: t('trends.7days') },
    { key: '30d', label: t('trends.30days') },
    { key: '90d', label: t('trends.90days') },
    { key: 'this_month', label: t('trends.thisMonth') },
    { key: 'last_month', label: t('trends.lastMonth') },
    { key: 'ytd', label: t('trends.yearToDate') },
    { key: 'custom', label: t('trends.custom') },
  ]

  const metricOptions: { key: Metric; label: string }[] = [
    { key: 'net_sales', label: t('trends.revenue') },
    { key: 'guests', label: t('trends.guests') },
    { key: 'orders', label: t('trends.orders') },
    { key: 'avg_spending', label: t('trends.avgSpending') },
  ]

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sales', label: t('trends.tabSales') },
    { key: 'channel', label: t('trends.tabChannel') },
  ]

  // Build weather map for channel chart overlay
  const weatherMap = useMemo(() => buildWeatherMap(weatherData), [weatherData])

  // Prepare channel daily chart data with weather
  const channelDailyChartData = useMemo(() => {
    if (!channelData) return []
    return channelData.daily.map((d) => {
      const w = weatherMap.get(d.date)
      return {
        ...d,
        dateLabel: format(new Date(d.date), 'M/d'),
        precipitation: w?.precipitation ?? null,
      }
    })
  }, [channelData, weatherMap])

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
        <h1 className="text-xl font-bold text-slate-900">{t('trends.title')}</h1>
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

      {/* Tab Selector */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== Sales Tab ===== */}
      {activeTab === 'sales' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              title={t('trends.periodRevenue')}
              value={`NT$${totalRevenue.toLocaleString()}`}
              change={revenueChange}
              changeLabel={changeLabel}
              icon={<DollarSign size={20} />}
            />
            <KpiCard
              title={t('trends.dailyAvgRevenue')}
              value={`NT$${Math.round(avgDaily).toLocaleString()}`}
              change={avgDailyChange}
              changeLabel={changeLabel}
              icon={<TrendingUp size={20} />}
            />
            <KpiCard
              title={t('trends.periodGuests')}
              value={totalGuests.toLocaleString()}
              change={guestsChange}
              changeLabel={changeLabel}
              icon={<Users size={20} />}
            />
            <KpiCard
              title={t('trends.periodOrders')}
              value={totalOrders.toLocaleString()}
              change={ordersChange}
              changeLabel={changeLabel}
              icon={<ShoppingCart size={20} />}
            />
            <KpiCard
              title={t('trends.avgSpending')}
              value={`NT$${Math.round(avgSpending).toLocaleString()}`}
              change={avgSpendingChange}
              changeLabel={changeLabel}
              icon={<Receipt size={20} />}
            />
          </div>

          {/* Target Achievement Card */}
          {rangeTarget != null && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-red-500" />
                <h2 className="text-sm font-semibold text-slate-900">{t('trends.goalRate')}</h2>
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
                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      achievementPct != null && achievementPct >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(achievementPct ?? 0, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {t('trends.dailyGoal')} NT${dailyTarget != null ? Math.round(dailyTarget).toLocaleString() : '--'}
                  {' · '}
                  {t('trends.dailyActual')} NT${Math.round(avgDaily).toLocaleString()}
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
                {t('trends.noGoalPrefix')}
                <a href="/settings" className="text-blue-600 hover:underline mx-1">{t('trends.systemSettings')}</a>
                {t('trends.setAnnualGoal')}
              </p>
            </div>
          )}

          {/* Trend Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">{t('trends.trendChart')}</h2>
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

          {/* Weekday x Hour Heatmap */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('trends.heatmap')}
                <span className="text-xs font-normal text-slate-400 ml-2">{t('trends.avgRevenue')}</span>
              </h2>
              {weatherData.length > 0 && (
                <div className="flex gap-1">
                  {([['all', t('common.all')], ['sunny', `☀️ ${t('trends.sunny')}`], ['rainy', `🌧 ${t('trends.rainy')}`]] as [string, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setHeatmapWeatherFilter(key as 'all' | 'sunny' | 'rainy')}
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
                const type = getWeatherType(w)
                return type === 'sunny' || type === 'cloudy' || type === 'other'
              })
            })()} />
          </div>
        </>
      )}

      {/* ===== Channel (Dine-in vs Takeout) Tab ===== */}
      {activeTab === 'channel' && (
        <>
          {!channelData || (channelData.summary.dine_in.order_count === 0 && channelData.summary.takeout.order_count === 0) ? (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <UtensilsCrossed size={24} className="text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{t('trends.noChannelData')}</p>
            </div>
          ) : (
            <>
              {/* Channel KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title={t('trends.dineInOrderPct')}
                  value={`${channelData.summary.dine_in.order_pct}%`}
                  subtitle={`${channelData.summary.dine_in.order_count.toLocaleString()} ${t('trends.orderCountLabel')}`}
                  icon={<UtensilsCrossed size={20} />}
                />
                <KpiCard
                  title={t('trends.takeoutOrderPct')}
                  value={`${channelData.summary.takeout.order_pct}%`}
                  subtitle={`${channelData.summary.takeout.order_count.toLocaleString()} ${t('trends.orderCountLabel')}`}
                  icon={<ShoppingBag size={20} />}
                />
                <KpiCard
                  title={t('trends.dineInAvgSpend')}
                  value={`NT$${channelData.summary.dine_in.avg_spend.toLocaleString()}`}
                  subtitle={(() => {
                    const diff = channelData.summary.dine_in.avg_spend - channelData.summary.takeout.avg_spend
                    const sign = diff >= 0 ? '+' : ''
                    return `${sign}NT$${diff.toLocaleString()} ${t('trends.vsOther')}`
                  })()}
                  icon={<DollarSign size={20} />}
                />
                <KpiCard
                  title={t('trends.takeoutAvgSpend')}
                  value={`NT$${channelData.summary.takeout.avg_spend.toLocaleString()}`}
                  icon={<DollarSign size={20} />}
                />
              </div>

              {/* Order Count Trend — Stacked AreaChart with Weather */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">{t('trends.orderTrend')}</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={channelDailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    {weatherData.length > 0 && (
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    )}
                    <Tooltip
                      formatter={(val, name) => {
                        const v = Number(val)
                        if (name === t('trends.precipitation')) return [`${v}mm`, name]
                        return [v.toLocaleString(), name]
                      }}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="dine_in_orders"
                      name={t('trends.dineIn')}
                      stackId="orders"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="takeout_orders"
                      name={t('trends.takeout')}
                      stackId="orders"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.6}
                    />
                    {weatherData.length > 0 && (
                      <Bar
                        yAxisId="right"
                        dataKey="precipitation"
                        name={t('trends.precipitation')}
                        fill="#93c5fd"
                        opacity={0.4}
                        radius={[2, 2, 0, 0]}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Trend — Stacked BarChart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">{t('trends.revenueTrend')}</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={channelDailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(val) => {
                        const v = Number(val)
                        return [`NT$${v.toLocaleString()}`]
                      }}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                    <Bar
                      dataKey="dine_in_revenue"
                      name={t('trends.dineIn')}
                      stackId="revenue"
                      fill="#3b82f6"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="takeout_revenue"
                      name={t('trends.takeout')}
                      stackId="revenue"
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Hourly Distribution — Grouped BarChart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">{t('trends.hourlyDistribution')}</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={channelData.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(val) => {
                        const v = Number(val)
                        return [v.toLocaleString()]
                      }}
                      labelFormatter={(h) => `${h}:00`}
                    />
                    <Legend />
                    <Bar
                      dataKey="dine_in_orders"
                      name={t('trends.dineIn')}
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="takeout_orders"
                      name={t('trends.takeout')}
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
