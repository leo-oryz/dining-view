'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesLineChart } from '@/components/charts/SalesLineChart'
import { KpiSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { DollarSign, Users, ShoppingCart, TrendingUp } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { type WeatherDaily, formatWeatherSummary, isTyphoon } from '@/lib/weather/weatherUtils'
import { useI18n } from '@/lib/i18n/context'

interface DailySales {
  date: string
  net_sales: number | null
  guests: number | null
  orders: number | null
  avg_spending: number | null
  member_visits: number | null
}

export default function DashboardPage() {
  const [data, setData] = useState<DailySales[]>([])
  const [weather, setWeather] = useState<WeatherDaily | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useI18n()

  useEffect(() => {
    const endDate = format(new Date(), 'yyyy-MM-dd')
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    Promise.all([
      fetch(`/api/sales/daily?start_date=${startDate}&end_date=${endDate}`).then(r => r.json()),
      fetch('/api/weather/today').then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([salesJson, weatherJson]) => {
        if (salesJson.success) setData(salesJson.data || [])
        if (weatherJson.success && weatherJson.data) setWeather(weatherJson.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const latest = data[0]
  const previous = data[1]

  const calcChange = (current: number | null, previous: number | null) => {
    if (!current || !previous || previous === 0) return null
    return ((current - previous) / previous) * 100
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
      </div>
    )
  }

  const latestDate = latest?.date
    ? format(new Date(latest.date + 'T00:00:00'), 'yyyy/MM/dd')
    : null

  const isTyphoonDay = weather ? isTyphoon(weather) : false

  return (
    <div className="space-y-6">
      {/* Weather Bar */}
      {weather ? (
        <div className={`rounded-xl border px-5 py-3 flex items-center gap-3 ${
          isTyphoonDay
            ? 'bg-red-50 border-red-300'
            : 'bg-white border-slate-200'
        }`}>
          <span className="text-lg">{formatWeatherSummary(weather)}</span>
          {isTyphoonDay && (
            <span className="ml-auto px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
              {t('dashboard.typhoonWarning')}
            </span>
          )}
        </div>
      ) : !loading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-sm text-slate-400">
          {t('dashboard.weatherSyncing')}
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="flex items-center justify-between -mb-2">
        <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.overview')}</h2>
        {latestDate && (
          <span className="text-sm text-slate-500">{t('dashboard.dataDate')}{latestDate}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('dashboard.netSales')}
          value={latest?.net_sales != null ? `NT$${latest.net_sales.toLocaleString()}` : '--'}
          change={calcChange(latest?.net_sales ?? null, previous?.net_sales ?? null)}
          changeLabel={t('dashboard.vsPrevDay')}
          icon={<DollarSign size={20} />}
        />
        <KpiCard
          title={t('dashboard.guests')}
          value={latest?.guests != null ? latest.guests.toLocaleString() : '--'}
          change={calcChange(latest?.guests ?? null, previous?.guests ?? null)}
          changeLabel={t('dashboard.vsPrevDay')}
          icon={<Users size={20} />}
        />
        <KpiCard
          title={t('dashboard.orders')}
          value={latest?.orders != null ? latest.orders.toLocaleString() : '--'}
          change={calcChange(latest?.orders ?? null, previous?.orders ?? null)}
          changeLabel={t('dashboard.vsPrevDay')}
          icon={<ShoppingCart size={20} />}
        />
        <KpiCard
          title={t('dashboard.avgSpending')}
          value={latest?.avg_spending != null ? `NT$${latest.avg_spending.toLocaleString()}` : '--'}
          change={calcChange(latest?.avg_spending ?? null, previous?.avg_spending ?? null)}
          changeLabel={t('dashboard.vsPrevDay')}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* 30-day Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">{t('dashboard.salesTrend')}</h3>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            {t('dashboard.loading')}
          </div>
        ) : (
          <SalesLineChart data={data} />
        )}
      </div>
    </div>
  )
}
