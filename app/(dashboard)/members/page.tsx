'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesLineChart } from '@/components/charts/SalesLineChart'
import { Users, UserPlus, UserCheck } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface DailySales {
  date: string
  member_visits: number | null
  new_members: number | null
  regular_members: number | null
  total_members: number | null
  net_sales: number | null
  guests: number | null
}

export default function MembersPage() {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="會員來客數"
          value={today?.member_visits != null ? today.member_visits.toLocaleString() : '--'}
          icon={<Users size={20} />}
        />
        <KpiCard
          title="今日新會員"
          value={today?.new_members != null ? today.new_members.toLocaleString() : '--'}
          icon={<UserPlus size={20} />}
        />
        <KpiCard
          title="總會員數"
          value={today?.total_members != null ? today.total_members.toLocaleString() : '--'}
          icon={<UserCheck size={20} />}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">30 天會員來客趨勢</h3>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            載入中...
          </div>
        ) : (
          <SalesLineChart
            data={data.map((d) => ({
              date: d.date,
              net_sales: d.member_visits,
              guests: d.new_members,
            }))}
          />
        )}
      </div>
    </div>
  )
}
