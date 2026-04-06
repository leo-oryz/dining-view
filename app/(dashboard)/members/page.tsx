'use client'

import { useEffect, useMemo, useState } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesLineChart } from '@/components/charts/SalesLineChart'
import { Users, UserPlus, UserCheck, Hotel, RefreshCw } from 'lucide-react'
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns'
import { type WeatherDaily, isTyphoon, buildWeatherMap } from '@/lib/weather/weatherUtils'
import RFMTrendChart from '@/components/members/RFMTrendChart'
import RFMDistributionChart from '@/components/members/RFMDistributionChart'
import DormantAlert from '@/components/members/DormantAlert'
import DemographicsPanel from '@/components/members/DemographicsPanel'

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

interface DemographicData {
  gender: { male: number; female: number; unknown: number }
  age: { label: string; count: number }[]
  channels: { direct: number; app: number; coupon: number; other: number }
}

interface HotelConversion {
  total_guests: number
  matched_guests: number
  conversion_rate: number
  avg_guest_spend: number
  recent_mappings: Array<{
    id: string
    guest_name: string
    check_in: string
    check_out: string
    ocard_member_id: string | null
    match_confidence: number
  }>
}

type RangeKey = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'ytd' | 'custom'

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: '90d', label: '90 天' },
  { key: 'this_month', label: '本月' },
  { key: 'last_month', label: '上月' },
  { key: 'ytd', label: '今年至今' },
  { key: 'custom', label: '自訂' },
]

export default function MembersPage() {
  const [data, setData] = useState<DailySales[]>([])
  const [rfmData, setRfmData] = useState<RFMSnapshot[]>([])
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherDaily>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'rfm' | 'demographics' | 'hotel'>('overview')
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [demoData, setDemoData] = useState<DemographicData | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [hotelData, setHotelData] = useState<HotelConversion | null>(null)
  const [hotelLoading, setHotelLoading] = useState(false)
  const [hotelConfigured, setHotelConfigured] = useState(false)
  const [hotelSyncing, setHotelSyncing] = useState(false)
  const [hotelSyncResult, setHotelSyncResult] = useState<string | null>(null)

  const { startDate, endDate } = useMemo(() => {
    if (rangeKey === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd }
    }
    const today = new Date()
    if (rangeKey === 'ytd') {
      return { startDate: format(startOfYear(today), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') }
    }
    if (rangeKey === 'this_month') {
      return { startDate: format(startOfMonth(today), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') }
    }
    if (rangeKey === 'last_month') {
      const lm = subMonths(today, 1)
      return { startDate: format(startOfMonth(lm), 'yyyy-MM-dd'), endDate: format(endOfMonth(lm), 'yyyy-MM-dd') }
    }
    const days = rangeKey === '7d' ? 7 : rangeKey === '90d' ? 90 : 30
    return { startDate: format(subDays(today, days), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') }
  }, [rangeKey, customStart, customEnd])

  // Fetch overview data (reactive to date range)
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/sales/daily?start_date=${startDate}&end_date=${endDate}`).then(r => r.json()),
      fetch(`/api/weather/range?from=${startDate}&to=${endDate}`).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([salesJson, weatherJson]) => {
      if (salesJson.success) setData(salesJson.data || [])
      if (weatherJson.success) setWeatherMap(buildWeatherMap(weatherJson.data || []))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [startDate, endDate])

  // Fetch RFM + hotel data once on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/members/rfm').then(r => r.json()),
      fetch('/api/hotel/conversion').then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([rfmJson, hotelJson]) => {
      if (rfmJson.success) setRfmData(rfmJson.data || [])
      if (hotelJson.success) {
        setHotelConfigured(true)
        setHotelData(hotelJson.data)
      }
    }).catch(() => {})
  }, [])

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
        <button
          onClick={() => {
            setActiveTab('demographics')
            if (!demoData && !demoLoading) {
              setDemoLoading(true)
              fetch('/api/members/demographics')
                .then(r => r.json())
                .then(json => { if (json.success) setDemoData(json.data) })
                .catch(() => {})
                .finally(() => setDemoLoading(false))
            }
          }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'demographics'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          人口統計
        </button>
        {hotelConfigured && (
          <button
            onClick={() => {
              setActiveTab('hotel')
              if (!hotelData) {
                setHotelLoading(true)
                fetch('/api/hotel/conversion')
                  .then(r => r.json())
                  .then(json => { if (json.success) setHotelData(json.data) })
                  .catch(() => {})
                  .finally(() => setHotelLoading(false))
              }
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'hotel'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            住客轉換
          </button>
        )}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Date range picker */}
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
            {rangeKey === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="期間會員來客數"
              value={data.length > 0 ? data.reduce((s, d) => s + (d.member_visits || 0), 0).toLocaleString() : '--'}
              icon={<Users size={20} />}
            />
            <KpiCard
              title="期間新會員"
              value={data.length > 0 ? data.reduce((s, d) => s + (d.new_members || 0), 0).toLocaleString() : '--'}
              icon={<UserPlus size={20} />}
            />
            <KpiCard
              title="總會員數"
              value={data.length > 0 && data[0]?.total_members != null ? data[0].total_members.toLocaleString() : '--'}
              icon={<UserCheck size={20} />}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">會員來客趨勢</h3>
            {loading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                載入中...
              </div>
            ) : (
              <>
                <SalesLineChart
                  data={data.map((d) => ({
                    date: d.date,
                    net_sales: d.member_visits,
                    guests: d.new_members,
                  }))}
                />
                {/* Typhoon day annotations */}
                {(() => {
                  const typhoonDays = data.filter(d => {
                    const w = weatherMap.get(d.date)
                    return w && isTyphoon(w)
                  })
                  if (typhoonDays.length === 0) return null
                  return (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {typhoonDays.map(d => (
                        <span key={d.date} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg">
                          🌀 {d.date} 颱風日 — 來客數極低，新會員數不具參考性
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </>
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

      {activeTab === 'demographics' && (
        <DemographicsPanel data={demoData} loading={demoLoading} />
      )}

      {activeTab === 'hotel' && (
        <>
          {/* Sync button */}
          <div className="flex justify-end">
            <button
              onClick={async () => {
                setHotelSyncing(true)
                setHotelSyncResult(null)
                try {
                  const res = await fetch('/api/hotel/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                  const json = await res.json()
                  if (json.success) {
                    setHotelSyncResult(`同步完成：${json.data.synced} 位住客，${json.data.matched} 位匹配 (${json.data.match_rate})`)
                    // Refresh data
                    const convRes = await fetch('/api/hotel/conversion')
                    const convJson = await convRes.json()
                    if (convJson.success) setHotelData(convJson.data)
                  } else {
                    setHotelSyncResult(`同步失敗：${json.error}`)
                  }
                } catch {
                  setHotelSyncResult('同步失敗')
                }
                setHotelSyncing(false)
              }}
              disabled={hotelSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={hotelSyncing ? 'animate-spin' : ''} />
              {hotelSyncing ? '同步中...' : 'Sync Cloudbeds'}
            </button>
          </div>

          {hotelSyncResult && (
            <div className={`text-sm px-4 py-2 rounded-lg ${hotelSyncResult.includes('完成') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {hotelSyncResult}
            </div>
          )}

          {/* Hotel KPIs */}
          {hotelLoading ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">載入中...</div>
          ) : hotelData ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard
                  title="總住客數"
                  value={hotelData.total_guests.toLocaleString()}
                  icon={<Hotel size={20} />}
                />
                <KpiCard
                  title="已匹配會員"
                  value={hotelData.matched_guests.toLocaleString()}
                  icon={<UserCheck size={20} />}
                />
                <KpiCard
                  title="轉換率"
                  value={`${hotelData.conversion_rate}%`}
                />
                <KpiCard
                  title="住客平均消費"
                  value={`NT$ ${hotelData.avg_guest_spend.toLocaleString()}`}
                />
              </div>

              {/* Recent mappings table */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-5 py-3 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900">近期住客匹配</h4>
                </div>
                {hotelData.recent_mappings.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">尚無住客資料</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-slate-500 font-medium">住客姓名</th>
                          <th className="text-left py-3 px-4 text-slate-500 font-medium">入住</th>
                          <th className="text-left py-3 px-4 text-slate-500 font-medium">退房</th>
                          <th className="text-left py-3 px-4 text-slate-500 font-medium">匹配狀態</th>
                          <th className="text-right py-3 px-4 text-slate-500 font-medium">信心度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hotelData.recent_mappings.map(m => (
                          <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-900">{m.guest_name}</td>
                            <td className="py-3 px-4 text-slate-500">{m.check_in}</td>
                            <td className="py-3 px-4 text-slate-500">{m.check_out}</td>
                            <td className="py-3 px-4">
                              {m.ocard_member_id ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">已匹配</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-medium">未匹配</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-500">
                              {m.match_confidence > 0 ? `${(m.match_confidence * 100).toFixed(0)}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <p className="text-sm text-amber-800">請先點擊「Sync Cloudbeds」同步住客資料。</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
