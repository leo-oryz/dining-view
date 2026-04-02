'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesLineChart } from '@/components/charts/SalesLineChart'
import { Users, UserPlus, UserCheck } from 'lucide-react'
import { format, subDays } from 'date-fns'
import RFMTrendChart from '@/components/members/RFMTrendChart'
import RFMDistributionChart from '@/components/members/RFMDistributionChart'
import DormantAlert from '@/components/members/DormantAlert'

interface DailySales {
  date: string
  member_visits: number | null
  new_members: number | null
  regular_members: number | null
  total_members: number | null
  net_sales: number | null
  guests: number | null
}

interface RFMSnapshot {
  snapshot_date: string
  total_customers: number | null
  gold_count: number | null
  regular_count: number | null
  dormant_count: number | null
  r_distribution: Record<string, number> | null
  f_distribution: Record<string, number> | null
  m_distribution: Record<string, number> | null
}

export default function MembersPage() {
  const [data, setData] = useState<DailySales[]>([])
  const [rfmData, setRfmData] = useState<RFMSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'rfm'>('overview')

  useEffect(() => {
    const endDate = format(new Date(), 'yyyy-MM-dd')
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    Promise.all([
      fetch(`/api/sales/daily?start_date=${startDate}&end_date=${endDate}`).then(r => r.json()),
      fetch('/api/members/rfm').then(r => r.json()),
    ]).then(([salesJson, rfmJson]) => {
      if (salesJson.success) setData(salesJson.data || [])
      if (rfmJson.success) setRfmData(rfmJson.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const today = data[0]
  const latestRfm = rfmData.length > 0 ? rfmData[rfmData.length - 1] : null

  // Calculate dormant percentage from latest snapshot
  const dormantPct = latestRfm && latestRfm.total_customers
    ? ((Number(latestRfm.dormant_count) || 0) / Number(latestRfm.total_customers)) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          會員概覽
        </button>
        <button
          onClick={() => setActiveTab('rfm')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'rfm'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          RFM 分析
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
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
        </>
      )}

      {activeTab === 'rfm' && (
        <>
          {/* Dormant alert */}
          <DormantAlert dormantPct={dormantPct} />

          {/* RFM KPI cards */}
          {latestRfm && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                title="總客戶數"
                value={latestRfm.total_customers?.toLocaleString() || '--'}
              />
              <KpiCard
                title="金牌會員"
                value={Number(latestRfm.gold_count)?.toLocaleString() || '--'}
              />
              <KpiCard
                title="一般會員"
                value={Number(latestRfm.regular_count)?.toLocaleString() || '--'}
              />
              <KpiCard
                title="沉睡會員"
                value={Number(latestRfm.dormant_count)?.toLocaleString() || '--'}
              />
            </div>
          )}

          {/* RFM Trend Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">RFM 分群趨勢</h4>
            {loading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">載入中...</div>
            ) : (
              <RFMTrendChart data={rfmData} />
            )}
          </div>

          {/* RFM Distribution Charts */}
          {latestRfm && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <RFMDistributionChart
                  title="R (最近消費) 分佈"
                  data={latestRfm.r_distribution}
                  color="#3b82f6"
                />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <RFMDistributionChart
                  title="F (消費頻率) 分佈"
                  data={latestRfm.f_distribution}
                  color="#10b981"
                />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <RFMDistributionChart
                  title="M (消費金額) 分佈"
                  data={latestRfm.m_distribution}
                  color="#f59e0b"
                />
              </div>
            </div>
          )}

          {!latestRfm && !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <p className="text-sm text-amber-800">尚無 RFM 分析資料。請先上傳 Ocard RFM 報表。</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
