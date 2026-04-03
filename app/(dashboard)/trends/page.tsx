'use client'

import { useEffect, useState, useMemo } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { TrendLineChart } from '@/components/charts/TrendLineChart'
import { WeekdayHeatmap } from '@/components/charts/WeekdayHeatmap'
import { KpiSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { DollarSign, Users, ShoppingCart, Target, TrendingUp, Pencil, X, Check } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns'

type RangeKey = '7d' | '30d' | '90d' | 'custom'
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

export default function TrendsPage() {
  const [data, setData] = useState<DailySales[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<Metric>('net_sales')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const { startDate, endDate } = useMemo(() => {
    if (rangeKey === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd }
    }
    const days = rangeKey === '7d' ? 7 : rangeKey === '90d' ? 90 : 30
    return {
      startDate: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }
  }, [rangeKey, customStart, customEnd])

  // Fetch daily sales
  useEffect(() => {
    setLoading(true)
    const params = `start_date=${startDate}&end_date=${endDate}`
    Promise.all([
      fetch(`/api/sales/daily?${params}`).then((r) => r.json()),
      fetch(`/api/sales/hourly?${params}`).then((r) => r.json()),
    ])
      .then(([dailyJson, hourlyJson]) => {
        if (dailyJson.success) setData(dailyJson.data || [])
        if (hourlyJson.success) setHourlyData(hourlyJson.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  // Fetch monthly target for current month
  useEffect(() => {
    const monthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    fetch(`/api/targets?month=${monthStr}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          setMonthlyTarget(json.data[0])
        } else {
          setMonthlyTarget(null)
        }
      })
      .catch(() => {})
  }, [])

  // Compute KPIs
  const totalRevenue = data.reduce((sum, d) => sum + (d.net_sales ?? 0), 0)
  const totalGuests = data.reduce((sum, d) => sum + (d.guests ?? 0), 0)
  const totalOrders = data.reduce((sum, d) => sum + (d.orders ?? 0), 0)
  const daysWithData = data.filter((d) => d.net_sales != null).length
  const avgDaily = daysWithData > 0 ? totalRevenue / daysWithData : 0

  // Monthly target progress (only for current month data)
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const thisMonthData = data.filter((d) => d.date >= monthStart && d.date <= monthEnd)
  const thisMonthRevenue = thisMonthData.reduce((sum, d) => sum + (d.net_sales ?? 0), 0)
  const daysInMonth = getDaysInMonth(now)
  const dayOfMonth = now.getDate()
  const targetAmount = monthlyTarget?.revenue_target ?? null

  // Daily target = monthly target / days in month
  const dailyTarget = targetAmount != null ? targetAmount / daysInMonth : null

  // Expected progress (linear) vs actual
  const expectedProgress = targetAmount != null ? (dayOfMonth / daysInMonth) * targetAmount : null
  const progressPct = targetAmount != null && targetAmount > 0 ? (thisMonthRevenue / targetAmount) * 100 : null
  const vsExpected =
    expectedProgress != null && expectedProgress > 0
      ? ((thisMonthRevenue - expectedProgress) / expectedProgress) * 100
      : null

  // WoW comparison
  const halfLen = Math.floor(data.length / 2)
  const recentHalf = data.slice(0, halfLen)
  const olderHalf = data.slice(halfLen)
  const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((s, d) => s + (d.net_sales ?? 0), 0) / recentHalf.length : 0
  const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((s, d) => s + (d.net_sales ?? 0), 0) / olderHalf.length : 0
  const periodChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : null

  const handleSaveTarget = async () => {
    const value = parseFloat(targetInput)
    if (isNaN(value) || value < 0) return
    const monthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: '00000000-0000-0000-0000-000000000001',
        month: monthStr,
        revenue_target: value,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setMonthlyTarget({ month: monthStr, revenue_target: value })
      setEditingTarget(false)
    }
  }

  const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: '7d', label: '7 天' },
    { key: '30d', label: '30 天' },
    { key: '90d', label: '90 天' },
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

      {/* Monthly Target Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              {format(now, 'yyyy 年 M 月')}營收目標
            </h2>
          </div>
          {!editingTarget && (
            <button
              onClick={() => {
                setTargetInput(targetAmount?.toString() ?? '')
                setEditingTarget(true)
              }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil size={14} />
              {targetAmount != null ? '修改目標' : '設定目標'}
            </button>
          )}
        </div>

        {editingTarget ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">NT$</span>
            <input
              type="number"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="例如 500000"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleSaveTarget}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
            >
              <Check size={18} />
            </button>
            <button
              onClick={() => setEditingTarget(false)}
              className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        ) : targetAmount != null ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  NT${thisMonthRevenue.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-2">
                    / NT${targetAmount.toLocaleString()}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-semibold ${progressPct != null && progressPct >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                  {progressPct != null ? `${progressPct.toFixed(1)}%` : '--'}
                </p>
                {vsExpected != null && (
                  <p className={`text-xs ${vsExpected >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {vsExpected >= 0 ? '超前' : '落後'}預期 {Math.abs(vsExpected).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
              {/* Expected progress marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-slate-400 z-10"
                style={{ left: `${Math.min((dayOfMonth / daysInMonth) * 100, 100)}%` }}
                title={`預期進度 ${((dayOfMonth / daysInMonth) * 100).toFixed(0)}%`}
              />
              {/* Actual progress */}
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPct != null && progressPct >= 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(progressPct ?? 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>第 {dayOfMonth} 天 / {daysInMonth} 天</span>
              <span>日均目標 NT${dailyTarget != null ? Math.round(dailyTarget).toLocaleString() : '--'}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">尚未設定本月營收目標，點擊右上角設定</p>
        )}
      </div>

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
        <TrendLineChart data={data} dailyTarget={dailyTarget} metric={metric} />
      </div>

      {/* Weekday × Hour Heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">
          週間 × 時段熱力圖
          <span className="text-xs font-normal text-slate-400 ml-2">平均營收</span>
        </h2>
        <WeekdayHeatmap data={hourlyData} />
      </div>
    </div>
  )
}
