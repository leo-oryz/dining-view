'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, Search, MousePointerClick, Users, ArrowUpRight, ArrowDownRight, Calendar, RefreshCw, type LucideIcon } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { useI18n } from '@/lib/i18n/context'

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
  new_members: number
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

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function defaultEnd() {
  const d = new Date()
  d.setDate(d.getDate() - 3)
  return d
}

export default function DigitalPage() {
  const { t } = useI18n()
  const [gscData, setGscData] = useState<GscRow[]>([])
  const [ga4Data, setGa4Data] = useState<Ga4Row[]>([])
  const [conversionData, setConversionData] = useState<ConversionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error' | 'skipped'>('idle')
  const [syncDetail, setSyncDetail] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<number | null>(30)

  const RANGE_OPTIONS = [
    { label: t('digital.last7'), days: 7 },
    { label: t('digital.last30'), days: 30 },
    { label: t('digital.last90'), days: 90 },
    { label: t('digital.last180'), days: 180 },
  ] as const

  const end = defaultEnd()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const [startDate, setStartDate] = useState(toDateStr(start))
  const [endDate, setEndDate] = useState(toDateStr(end))
  const prevRange = useRef(`${toDateStr(start)}|${toDateStr(end)}`)

  const loadData = useCallback(async (sd: string, ed: string) => {
    setLoading(true)
    const [gscRes, ga4Res, convRes] = await Promise.all([
      fetch(`/api/google/gsc/brand-search?start_date=${sd}&end_date=${ed}`),
      fetch(`/api/google/ga4/events?start_date=${sd}&end_date=${ed}`),
      fetch(`/api/google/conversion?start_date=${sd}&end_date=${ed}`),
    ])

    const [gscJson, ga4Json, convJson] = await Promise.all([
      gscRes.json(), ga4Res.json(), convRes.json(),
    ])

    if (gscJson.success) setGscData(gscJson.data || [])
    if (ga4Json.success) setGa4Data(ga4Json.data || [])
    if (convJson.success) setConversionData(convJson.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const key = `${startDate}|${endDate}`
    if (key !== prevRange.current) {
      prevRange.current = key
      loadData(startDate, endDate)
    }
  }, [startDate, endDate, loadData])

  useEffect(() => {
    loadData(startDate, endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectPreset(days: number) {
    setActivePreset(days)
    const e = defaultEnd()
    const s = new Date(e)
    s.setDate(s.getDate() - days)
    setStartDate(toDateStr(s))
    setEndDate(toDateStr(e))
  }

  async function handleSync() {
    setSyncing(true)
    setSyncStatus('idle')
    setSyncDetail(null)
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const stores = (json.data ?? {}) as Record<string, Record<string, string>>
        const entries = Object.entries(stores)
        const isSkip = (msg?: string) => !!msg && msg.startsWith('skipped')
        const allSkipped = entries.length > 0 && entries.every(([, r]) => isSkip(r.gsc) && isSkip(r.ga4))
        if (allSkipped) {
          setSyncStatus('skipped')
          setSyncDetail(t('digital.syncSkippedHint'))
        } else {
          setSyncStatus('success')
          const summary = entries
            .map(([name, r]) => `${name}: GSC ${r.gsc ?? '—'} / GA4 ${r.ga4 ?? '—'}`)
            .join('\n')
          setSyncDetail(summary || null)
          loadData(startDate, endDate)
        }
      } else {
        setSyncStatus('error')
        setSyncDetail(json.error ?? null)
      }
    } catch (e) {
      setSyncStatus('error')
      setSyncDetail(e instanceof Error ? e.message : null)
    } finally {
      setSyncing(false)
      setTimeout(() => { setSyncStatus('idle'); setSyncDetail(null) }, 10000)
    }
  }

  // Compute latest data dates
  const gscLatestDate = gscData.length > 0
    ? gscData.reduce((max, r) => r.date > max ? r.date : max, gscData[0].date)
    : null
  const ga4LatestDate = ga4Data.length > 0
    ? ga4Data.reduce((max, r) => r.date > max ? r.date : max, ga4Data[0].date)
    : null

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
      newMembers: row.new_members,
      rate: (row.conversion_rate * 100),
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-slate-400">{t('common.loading')}</div>
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
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('digital.title')}</h2>
        <p className="text-slate-500 text-sm mb-4">{t('digital.noData')}</p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors ${
            syncStatus === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : syncStatus === 'skipped'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : syncStatus === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing
            ? t('digital.syncing')
            : syncStatus === 'success'
            ? t('digital.syncSuccess')
            : syncStatus === 'skipped'
            ? t('digital.syncSkipped')
            : syncStatus === 'error'
            ? t('digital.syncFailed')
            : t('digital.syncNow')}
        </button>
        {syncDetail && (
          <p className={`text-xs mt-3 max-w-md whitespace-pre-line ${syncStatus === 'skipped' ? 'text-amber-700' : syncStatus === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
            {syncDetail}
          </p>
        )}
        <p className="text-slate-400 text-xs mt-4">
          {t('digital.noDataHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Data Freshness + Sync */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {gscLatestDate && (
            <span className="text-slate-500">
              GSC {t('digital.dataAsOf')}: <span className="font-medium text-slate-700">{gscLatestDate}</span>
            </span>
          )}
          {ga4LatestDate && (
            <span className="text-slate-500">
              GA4 {t('digital.dataAsOf')}: <span className="font-medium text-slate-700">{ga4LatestDate}</span>
            </span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            syncStatus === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : syncStatus === 'skipped'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : syncStatus === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
          } disabled:opacity-50`}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing
            ? t('digital.syncing')
            : syncStatus === 'success'
            ? t('digital.syncSuccess')
            : syncStatus === 'skipped'
            ? t('digital.syncSkipped')
            : syncStatus === 'error'
            ? t('digital.syncFailed')
            : t('digital.syncNow')}
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => selectPreset(opt.days)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activePreset === opt.days
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setActivePreset(null) }}
            className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setActivePreset(null) }}
            className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={t('digital.brandClicks')} value={totalClicks.toLocaleString()} icon={MousePointerClick} />
        <KpiCard title={t('digital.searchImpressions')} value={totalImpressions.toLocaleString()} icon={Search} />
        <KpiCard title={t('digital.sessions')} value={totalSessions.toLocaleString()} icon={TrendingUp} />
        <KpiCard title={t('digital.newUsers')} value={totalNewUsers.toLocaleString()} icon={Users} />
      </div>

      {/* GSC Brand Search Chart */}
      {gscChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('digital.brandSearchTrend')} (Google Search Console)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={gscChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="clicks" name={t('digital.clicks')} stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="impressions" name={t('digital.impressions')} stroke="#94a3b8" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* GA4 Sessions Chart */}
      {ga4ChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('digital.trafficTrend')} (Google Analytics)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ga4ChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" name={t('digital.sessionsLabel')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="newUsers" name={t('digital.newUsers')} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conversion Chart */}
      {convChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('digital.memberConversion')} (GA4 {t('digital.clicks')} → Ocard {t('digital.newMembers')})</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={convChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Bar dataKey="clicks" name={t('digital.ga4Clicks')} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="newMembers" name={t('digital.newMembers')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Queries Table */}
      {gscData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('digital.topKeywords')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-slate-500 font-medium">{t('digital.keyword')}</th>
                  <th className="text-right py-2 text-slate-500 font-medium">{t('digital.clicks')}</th>
                  <th className="text-right py-2 text-slate-500 font-medium">{t('digital.impressions')}</th>
                  <th className="text-right py-2 text-slate-500 font-medium">{t('digital.ctr')}</th>
                  <th className="text-right py-2 text-slate-500 font-medium">{t('digital.ranking')}</th>
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
