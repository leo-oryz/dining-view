'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Search, MousePointerClick, Users, ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'

type GscRow = {
  date: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type Ga4Row = {
  date: string
  event_name: string
  event_count: number
  user_count: number
  new_users: number
  sessions: number
}

type ConversionRow = {
  date: string
  ga4_clicks: number
  ocard_new_members: number
  conversion_rate: number
}

function KpiCard({ title, value, icon: Icon, change }: {
  title: string
  value: string
  icon: LucideIcon
  change?: number | null
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{title}</span>
        <Icon size={18} className="text-slate-400" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {change !== undefined && change !== null && (
        <div className={`flex items-center text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

export default function DigitalPage() {
  const [gscData, setGscData] = useState<GscRow[]>([])
  const [ga4Data, setGa4Data] = useState<Ga4Row[]>([])
  const [conversionData, setConversionData] = useState<ConversionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const end = new Date()
      end.setDate(end.getDate() - 3)
      const start = new Date(end)
      start.setDate(start.getDate() - 30)
      const startStr = start.toISOString().slice(0, 10)
      const endStr = end.toISOString().slice(0, 10)

      const [gscRes, ga4Res, convRes] = await Promise.all([
        fetch(`/api/google/gsc/brand-search?start_date=${startStr}&end_date=${endStr}`),
        fetch(`/api/google/ga4/events?start_date=${startStr}&end_date=${endStr}`),
        fetch(`/api/google/conversion?start_date=${startStr}&end_date=${endStr}`),
      ])

      const [gscJson, ga4Json, convJson] = await Promise.all([
        gscRes.json(), ga4Res.json(), convRes.json(),
      ])

      if (gscJson.success) setGscData(gscJson.data || [])
      if (ga4Json.success) setGa4Data(ga4Json.data || [])
      if (convJson.success) setConversionData(convJson.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Aggregate GSC data by date for chart
  const gscByDate = gscData.reduce<Record<string, { clicks: number; impressions: number }>>((acc, row) => {
    if (!acc[row.date]) acc[row.date] = { clicks: 0, impressions: 0 }
    acc[row.date].clicks += row.clicks
    acc[row.date].impressions += row.impressions
    return acc
  }, {})

  const gscChartData = Object.entries(gscByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date: date.slice(5), ...data }))

  // Aggregate GA4 sessions by date for chart
  const ga4ByDate = ga4Data.reduce<Record<string, { sessions: number; users: number; newUsers: number }>>((acc, row) => {
    if (!acc[row.date]) acc[row.date] = { sessions: 0, users: 0, newUsers: 0 }
    acc[row.date].sessions += row.sessions
    acc[row.date].users += row.user_count
    acc[row.date].newUsers += row.new_users
    return acc
  }, {})

  const ga4ChartData = Object.entries(ga4ByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date: date.slice(5), ...data }))

  // KPI totals
  const totalClicks = gscData.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = gscData.reduce((s, r) => s + r.impressions, 0)
  const totalSessions = ga4Data.reduce((s, r) => s + r.sessions, 0)
  const totalNewUsers = ga4Data.reduce((s, r) => s + r.new_users, 0)

  // Conversion chart
  const convChartData = [...conversionData]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: row.date.slice(5),
      clicks: row.ga4_clicks,
      newMembers: row.ocard_new_members,
      rate: (row.conversion_rate * 100),
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-slate-400">載入中...</div>
      </div>
    )
  }

  const hasData = gscData.length > 0 || ga4Data.length > 0

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="bg-blue-50 rounded-full p-4 mb-4">
          <TrendingUp size={32} className="text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">數位行銷數據</h2>
        <p className="text-slate-500 text-sm mb-4">尚未同步 Google 數據</p>
        <p className="text-slate-400 text-xs">
          請設定 Google Service Account 並執行 POST /api/google/sync 同步數據
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="品牌搜尋點擊" value={totalClicks.toLocaleString()} icon={MousePointerClick} />
        <KpiCard title="搜尋曝光" value={totalImpressions.toLocaleString()} icon={Search} />
        <KpiCard title="網站工作階段" value={totalSessions.toLocaleString()} icon={TrendingUp} />
        <KpiCard title="新使用者" value={totalNewUsers.toLocaleString()} icon={Users} />
      </div>

      {/* GSC Brand Search Chart */}
      {gscChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">品牌搜尋趨勢 (Google Search Console)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={gscChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="clicks" name="點擊" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="impressions" name="曝光" stroke="#94a3b8" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* GA4 Sessions Chart */}
      {ga4ChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">網站流量趨勢 (Google Analytics)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ga4ChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" name="工作階段" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="newUsers" name="新使用者" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conversion Chart */}
      {convChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">會員轉換追蹤 (GA4 點擊 → Ocard 新會員)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={convChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Bar dataKey="clicks" name="GA4 點擊" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="newMembers" name="新會員" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Queries Table */}
      {gscData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">熱門搜尋關鍵字</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-slate-500 font-medium">關鍵字</th>
                  <th className="text-right py-2 text-slate-500 font-medium">點擊</th>
                  <th className="text-right py-2 text-slate-500 font-medium">曝光</th>
                  <th className="text-right py-2 text-slate-500 font-medium">CTR</th>
                  <th className="text-right py-2 text-slate-500 font-medium">排名</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  gscData.reduce<Record<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }>>((acc, row) => {
                    if (!acc[row.query]) acc[row.query] = { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
                    acc[row.query].clicks += row.clicks
                    acc[row.query].impressions += row.impressions
                    acc[row.query].ctr += row.ctr
                    acc[row.query].position += row.position
                    acc[row.query].count += 1
                    return acc
                  }, {})
                )
                  .map(([query, data]) => ({
                    query,
                    clicks: data.clicks,
                    impressions: data.impressions,
                    ctr: data.ctr / data.count,
                    position: data.position / data.count,
                  }))
                  .sort((a, b) => b.clicks - a.clicks)
                  .slice(0, 20)
                  .map((row) => (
                    <tr key={row.query} className="border-b border-slate-100">
                      <td className="py-2 text-slate-900">{row.query}</td>
                      <td className="py-2 text-right text-slate-700">{row.clicks}</td>
                      <td className="py-2 text-right text-slate-700">{row.impressions}</td>
                      <td className="py-2 text-right text-slate-700">{(row.ctr * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right text-slate-700">{row.position.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
