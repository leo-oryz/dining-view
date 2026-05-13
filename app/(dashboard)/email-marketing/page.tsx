'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  AlertCircle,
  TrendingUp,
  Send,
  CheckCheck,
  Calendar,
  RefreshCw,
  Trophy,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { useI18n } from '@/lib/i18n/context'

interface Campaign {
  id: string
  ghl_campaign_id: string
  name: string
  sent_at: string | null
  sends: number
  deliveries: number
  opens: number
  clicks: number
  unsubscribes: number
  bounces: number
  open_rate: number | null
  ctr: number | null
  attributed_bookings: number
}

interface DailyPoint {
  date: string
  sends: number
  opens: number
  clicks: number
}

interface TopCampaign {
  id: string
  name: string
  sent_at: string | null
  sends: number
  opens: number
  clicks: number
  open_rate: number | null
}

interface Funnel {
  sends: number
  deliveries: number
  opens: number
  clicks: number
  unsubscribes: number
  bounces: number
}

interface Summary {
  days: number
  kpis: {
    campaigns_sent: number
    avg_open_rate: number | null
    avg_ctr: number | null
    attributed_bookings: number
  }
  funnel: Funnel
  timeseries: DailyPoint[]
  top_campaigns: TopCampaign[]
  campaigns: Campaign[]
  pagination: { total: number; offset: number; limit: number }
}

const PAGE_SIZE = 20
const RANGE_OPTIONS = [
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '180D', value: 180 },
  { label: '365D', value: 365 },
]

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(2)}%`
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return '—'
  return Math.round(v).toLocaleString('en-US')
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toISOString().slice(0, 10)
}

export default function EmailMarketingPage() {
  const { t } = useI18n()
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [days, setDays] = useState(90)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    fetch(
      `/api/email-marketing/summary?days=${days}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setData(json.data)
        else setData(null)
      })
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [days, page])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync/ghl', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const results = (json.data?.results ?? []) as Array<{
          campaigns?: number
          attribution_matches?: number
          skipped?: boolean
          error?: string
        }>
        const total = results.reduce((s, r) => s + (r.campaigns ?? 0), 0)
        const matched = results.reduce((s, r) => s + (r.attribution_matches ?? 0), 0)
        const errored = results.find((r) => r.error)
        if (errored?.error) {
          setSyncMsg({ kind: 'err', text: `Sync error: ${errored.error}` })
        } else if (results.every((r) => r.skipped)) {
          setSyncMsg({
            kind: 'err',
            text: 'No GHL API key configured — set it in Settings first.',
          })
        } else {
          setSyncMsg({
            kind: 'ok',
            text: `Synced ${total} campaigns · ${matched} attributed bookings`,
          })
          load()
        }
      } else {
        setSyncMsg({ kind: 'err', text: json.error ?? 'Sync failed' })
      }
    } catch (err) {
      setSyncMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Sync failed',
      })
    } finally {
      setSyncing(false)
    }
  }

  const empty = !loading && (!data || data.kpis.campaigns_sent === 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setDays(r.value)
                setPage(0)
              }}
              className={`px-3 py-1.5 text-xs rounded-md border ${
                days === r.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync from GoHighLevel'}
        </button>
      </div>

      {syncMsg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm border ${
            syncMsg.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {syncMsg.text}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">{t('common.loading')}</div>
      ) : empty ? (
        <EmptyState />
      ) : (
        <LoadedView data={data!} page={page} setPage={setPage} />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <Mail size={32} className="mx-auto text-slate-400 mb-3" />
      <h3 className="text-base font-semibold text-slate-900 mb-1">No email campaigns yet</h3>
      <p className="text-sm text-slate-500 mb-4">
        Connect GoHighLevel in Settings, then click <span className="font-medium">Sync from GoHighLevel</span> above.
      </p>
      <Link
        href="/settings"
        className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
      >
        Go to Settings
      </Link>
    </div>
  )
}

function LoadedView({
  data,
  page,
  setPage,
}: {
  data: Summary
  page: number
  setPage: (updater: (p: number) => number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE))
  const funnelData = buildFunnel(data.funnel)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Campaigns Sent" value={fmtInt(data.kpis.campaigns_sent)} icon={Send} />
        <KpiCard label="Avg Open Rate" value={fmtPct(data.kpis.avg_open_rate)} icon={CheckCheck} />
        <KpiCard label="Avg CTR" value={fmtPct(data.kpis.avg_ctr)} icon={TrendingUp} />
        <KpiCard
          label="Attributed Bookings"
          value={fmtInt(data.kpis.attributed_bookings)}
          icon={Calendar}
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>
          Booking attribution is estimated via UTM matching and may undercount. Set
          <code className="mx-1 px-1 bg-amber-100 rounded">utm_campaign</code>
          in your email links for best accuracy.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Engagement over time</h3>
          {data.timeseries.length === 0 ? (
            <div className="text-xs text-slate-400 py-8 text-center">
              No campaign sends in this range
            </div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data.timeseries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="sends"
                    name="Sends"
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="opens"
                    name="Opens"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Funnel</h3>
          {funnelData.every((d) => d.value === 0) ? (
            <div className="text-xs text-slate-400 py-8 text-center">No data</div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 16, left: 24, bottom: 5 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <FunnelRates funnel={data.funnel} />
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900">Top campaigns by open rate</h3>
        </div>
        {data.top_campaigns.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">Not enough data yet</div>
        ) : (
          <div className="space-y-2">
            {data.top_campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-sm text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-400">{fmtDate(c.sent_at)}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{fmtInt(c.sends)} sends</span>
                  <span className="font-semibold text-slate-900 w-14 text-right">
                    {fmtPct(c.open_rate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Campaigns</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Campaign</th>
                <th className="px-4 py-2 text-left">Sent</th>
                <th className="px-4 py-2 text-right">Sends</th>
                <th className="px-4 py-2 text-right">Open Rate</th>
                <th className="px-4 py-2 text-right">CTR</th>
                <th className="px-4 py-2 text-right">Unsubs</th>
                <th className="px-4 py-2 text-right">Attributed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-sm text-slate-400 py-8">
                    No campaigns in this page
                  </td>
                </tr>
              ) : (
                data.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{c.name}</td>
                    <td className="px-4 py-2 text-slate-500">{fmtDate(c.sent_at)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(c.sends)}</td>
                    <td className="px-4 py-2 text-right">{fmtPct(c.open_rate)}</td>
                    <td className="px-4 py-2 text-right">{fmtPct(c.ctr)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(c.unsubscribes)}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {fmtInt(c.attributed_bookings)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

function buildFunnel(f: Funnel): Array<{ stage: string; value: number }> {
  return [
    { stage: 'Sends', value: f.sends },
    { stage: 'Deliveries', value: f.deliveries },
    { stage: 'Opens', value: f.opens },
    { stage: 'Clicks', value: f.clicks },
  ]
}

function FunnelRates({ funnel }: { funnel: Funnel }) {
  const delivRate = funnel.sends > 0 ? (funnel.deliveries / funnel.sends) * 100 : null
  const openRate = funnel.deliveries > 0 ? (funnel.opens / funnel.deliveries) * 100 : null
  const ctOpen = funnel.opens > 0 ? (funnel.clicks / funnel.opens) * 100 : null

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
      <div>
        <p className="text-slate-400">Delivery</p>
        <p className="text-slate-900 font-semibold">{fmtPct(delivRate)}</p>
      </div>
      <div>
        <p className="text-slate-400">Open</p>
        <p className="text-slate-900 font-semibold">{fmtPct(openRate)}</p>
      </div>
      <div>
        <p className="text-slate-400">Click/Open</p>
        <p className="text-slate-900 font-semibold">{fmtPct(ctOpen)}</p>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Mail
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <Icon size={20} className="text-slate-400" />
      </div>
    </div>
  )
}
