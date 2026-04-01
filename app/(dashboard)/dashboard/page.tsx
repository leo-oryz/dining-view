'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesLineChart } from '@/components/charts/SalesLineChart'
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

  const today = data[0]
  const yesterday = data[1]

  const calcChange = (current: number | null, previous: number | null) => {
    if (!current || !previous || previous === 0) return null
    return ((current - previous) / previous) * 100
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="今日淨銷售額"
          value={today?.net_sales != null ? `NT$${today.net_sales.toLocaleString()}` : '--'}
          change={calcChange(today?.net_sales ?? null, yesterday?.net_sales ?? null)}
          changeLabel="vs 昨天"
          icon={<DollarSign size={20} />}
        />
        <KpiCard
          title="今日來客數"
          value={today?.guests != null ? today.guests.toLocaleString() : '--'}
          change={calcChange(today?.guests ?? null, yesterday?.guests ?? null)}
          changeLabel="vs 昨天"
          icon={<Users size={20} />}
        />
        <KpiCard
          title="今日訂單數"
          value={today?.orders != null ? today.orders.toLocaleString() : '--'}
          change={calcChange(today?.orders ?? null, yesterday?.orders ?? null)}
          changeLabel="vs 昨天"
          icon={<ShoppingCart size={20} />}
        />
        <KpiCard
          title="平均客單價"
          value={today?.avg_spending != null ? `NT$${today.avg_spending.toLocaleString()}` : '--'}
          change={calcChange(today?.avg_spending ?? null, yesterday?.avg_spending ?? null)}
          changeLabel="vs 昨天"
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
