'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesLineChart } from '@/components/charts/SalesLineChart'
import { KpiSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { DollarSign, Users, ShoppingCart, TrendingUp } from 'lucide-react'
import { format, subDays } from 'date-fns'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const endDate = format(new Date(), 'yyyy-MM-dd')
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    fetch(`/api/sales/daily?start_date=${startDate}&end_date=${endDate}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data || [])
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="flex items-center justify-between mb--2">
        <h2 className="text-lg font-semibold text-slate-900">最新概覽</h2>
        {latestDate && (
          <span className="text-sm text-slate-500">資料日期：{latestDate}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="淨銷售額"
          value={latest?.net_sales != null ? `NT$${latest.net_sales.toLocaleString()}` : '--'}
          change={calcChange(latest?.net_sales ?? null, previous?.net_sales ?? null)}
          changeLabel="vs 前一天"
          icon={<DollarSign size={20} />}
        />
        <KpiCard
          title="來客數"
          value={latest?.guests != null ? latest.guests.toLocaleString() : '--'}
          change={calcChange(latest?.guests ?? null, previous?.guests ?? null)}
          changeLabel="vs 前一天"
          icon={<Users size={20} />}
        />
        <KpiCard
          title="訂單數"
          value={latest?.orders != null ? latest.orders.toLocaleString() : '--'}
          change={calcChange(latest?.orders ?? null, previous?.orders ?? null)}
          changeLabel="vs 前一天"
          icon={<ShoppingCart size={20} />}
        />
        <KpiCard
          title="平均客單價"
          value={latest?.avg_spending != null ? `NT$${latest.avg_spending.toLocaleString()}` : '--'}
          change={calcChange(latest?.avg_spending ?? null, previous?.avg_spending ?? null)}
          changeLabel="vs 前一天"
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* 30-day Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">30 天銷售趨勢</h3>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            載入中...
          </div>
        ) : (
          <SalesLineChart data={data} />
        )}
      </div>
    </div>
  )
}
