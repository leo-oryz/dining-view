'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  CalendarRange, Users, AlertCircle, X, TrendingUp,
  Globe2, ListChecks,
} from 'lucide-react'
import clsx from 'clsx'

interface Bucket { name: string; count: number }
interface DailyPoint { date: string; reservations: number; covers: number }
interface SummaryData {
  kpis: {
    total: number
    covers: number
    avg_party_size: number
    no_show_rate: number
    cancellation_rate: number
    no_show_count: number
    cancelled_count: number
  }
  by_status: Bucket[]
  by_source: Bucket[]
  by_country: Bucket[]
  local_vs_tourist: { local: number; tourist: number; unknown: number }
  daily: DailyPoint[]
}

interface Reservation {
  id: string
  reserved_at: string
  party_size: number
  status: string
  source_channel: string | null
  guest_country: string | null
  memo: string | null
}

interface ListResponse {
  rows: Reservation[]
  page: number
  limit: number
  total: number
  total_pages: number
}

const RANGE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

const STATUS_OPTIONS = ['all', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#3b82f6',
  seated: '#10b981',
  completed: '#0ea5e9',
  cancelled: '#ef4444',
  no_show: '#f97316',
  unknown: '#94a3b8',
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  unknown: 'Unknown',
}

const COUNTRY_NAMES: Record<string, string> = {
  VN: 'Vietnam', CN: 'China', KR: 'Korea', TH: 'Thailand', TW: 'Taiwan',
  SG: 'Singapore', HK: 'Hong Kong', MY: 'Malaysia', PH: 'Philippines',
  JP: 'Japan', US: 'USA', GB: 'UK', AU: 'Australia', FR: 'France', DE: 'Germany',
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
const fmtInt = (v: number) => Math.round(v).toLocaleString()
const formatVNTime = (iso: string) => {
  const d = new Date(iso)
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return vn.toISOString().slice(0, 16).replace('T', ' ')
}

export default function ReservationsPage() {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [list, setList] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const applyPreset = (days: number) => {
    setStartDate(format(subDays(new Date(), days - 1), 'yyyy-MM-dd'))
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
    setPage(1)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = `from=${startDate}&to=${endDate}`
      const listQs = new URLSearchParams({
        from: startDate,
        to: endDate,
        status: statusFilter,
        country: countryFilter,
        page: String(page),
        limit: '20',
      }).toString()

      const [sumRes, listRes] = await Promise.all([
        fetch(`/api/reservations/summary?${qs}`),
        fetch(`/api/reservations/list?${listQs}`),
      ])

      const [sumJson, listJson] = await Promise.all([sumRes.json(), listRes.json()])

      if (sumJson.success) setSummary(sumJson.data)
      else setError(sumJson.error || 'Failed to load summary')

      if (listJson.success) setList(listJson.data)
      else if (!sumJson.success === false) setError(listJson.error || 'Failed to load list')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
    setLoading(false)
  }, [startDate, endDate, statusFilter, countryFilter, page])

  useEffect(() => { fetchData() }, [fetchData])

  const countryOptions = useMemo(() => {
    const set = new Set<string>(['all'])
    summary?.by_country.forEach((b) => { if (b.name && b.name !== 'unknown') set.add(b.name) })
    return Array.from(set)
  }, [summary])

  const topCountries = useMemo(() => {
    if (!summary) return []
    return summary.by_country
      .filter((b) => b.name !== 'unknown')
      .slice(0, 10)
      .map((b) => ({ ...b, label: COUNTRY_NAMES[b.name] ?? b.name }))
  }, [summary])

  const statusChartData = useMemo(() => {
    if (!summary) return []
    return summary.by_status.map((b) => ({
      name: STATUS_LABELS[b.name] ?? b.name,
      key: b.name,
      value: b.count,
    }))
  }, [summary])

  const localTouristData = useMemo(() => {
    if (!summary) return []
    const { local, tourist, unknown } = summary.local_vs_tourist
    return [
      { name: 'Local (VN)', value: local, color: '#10b981' },
      { name: 'Tourist', value: tourist, color: '#3b82f6' },
      { name: 'Unknown', value: unknown, color: '#cbd5e1' },
    ].filter((x) => x.value > 0)
  }, [summary])

  const isEmpty = !loading && summary && summary.kpis.total === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={20} className="text-slate-600" />
          <h3 className="text-base font-semibold text-slate-900">Reservations</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
          <input
            type="date" value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input
            type="date" value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="text-center text-slate-400 text-sm py-12">Loading…</div>
      ) : isEmpty ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-600 font-medium">No reservations in range</p>
          <p className="text-xs text-slate-400 mt-1">
            Configure a TableCheck shop ID in Settings, then run Sync Now.
          </p>
        </div>
      ) : summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Reservations" value={fmtInt(summary.kpis.total)} tone="blue" />
            <KpiCard label="Covers" value={fmtInt(summary.kpis.covers)} tone="emerald" />
            <KpiCard label="Avg Party" value={summary.kpis.avg_party_size.toFixed(2)} tone="indigo" />
            <KpiCard
              label="No-show"
              value={fmtPct(summary.kpis.no_show_rate)}
              sub={`${summary.kpis.no_show_count} bookings`}
              tone="orange"
            />
            <KpiCard
              label="Cancellations"
              value={fmtPct(summary.kpis.cancellation_rate)}
              sub={`${summary.kpis.cancelled_count} bookings`}
              tone="red"
            />
          </div>

          {/* Daily trend */}
          <Panel icon={<TrendingUp size={16} className="text-blue-500" />} title="Daily Trend">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.daily} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="reservations"
                    stroke="#3b82f6" strokeWidth={2} dot={false} name="Reservations" />
                  <Line yAxisId="right" type="monotone" dataKey="covers"
                    stroke="#10b981" strokeWidth={2} dot={false} name="Covers" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Country + Local/Tourist */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel icon={<Globe2 size={16} className="text-emerald-500" />} title="Top Guest Countries" className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topCountries} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" name="Reservations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Local vs Tourist">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={localTouristData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {localTouristData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Status + Source */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel icon={<ListChecks size={16} className="text-blue-500" />} title="Reservation Status">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Count">
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.key] ?? '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Booking Source">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.by_source.slice(0, 10)} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" name="Reservations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* Reservations table */}
      <Panel title="Reservations">
        <div className="px-5 pt-4 flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All status' : (STATUS_LABELS[s] ?? s)}</option>
            ))}
          </select>
          <select
            value={countryFilter}
            onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          >
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All countries' : (COUNTRY_NAMES[c] ?? c)}
              </option>
            ))}
          </select>
          {(statusFilter !== 'all' || countryFilter !== 'all') && (
            <button
              onClick={() => { setStatusFilter('all'); setCountryFilter('all'); setPage(1) }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Date / time</th>
                <th className="px-5 py-2 text-right font-medium">Party</th>
                <th className="px-5 py-2 text-left font-medium">Status</th>
                <th className="px-5 py-2 text-left font-medium">Source</th>
                <th className="px-5 py-2 text-left font-medium">Country</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list?.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">
                    No reservations match the filters.
                  </td>
                </tr>
              ) : (
                list?.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-700 font-mono text-xs">
                      {formatVNTime(r.reserved_at)}
                    </td>
                    <td className="px-5 py-2 text-right text-slate-700">{r.party_size}</td>
                    <td className="px-5 py-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${STATUS_COLORS[r.status] ?? '#94a3b8'}20`,
                          color: STATUS_COLORS[r.status] ?? '#475569',
                        }}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-slate-600">{r.source_channel ?? '—'}</td>
                    <td className="px-5 py-2 text-slate-600">
                      {r.guest_country
                        ? (COUNTRY_NAMES[r.guest_country] ?? r.guest_country)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {list && list.total_pages > 1 && (
          <div className="px-5 py-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
            <span>Page {list.page} of {list.total_pages} · {list.total} total</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(Math.min(list.total_pages, page + 1))}
                disabled={page >= list.total_pages}
                className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'blue' | 'emerald' | 'orange' | 'red' | 'indigo' }) {
  const toneClass = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    indigo: 'text-indigo-600',
  }[tone]
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={clsx('text-2xl font-semibold mt-1', toneClass)}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function Panel({ icon, title, children, className }: { icon?: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-slate-200', className)}>
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
