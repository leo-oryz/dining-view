'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  AlertCircle,
  TrendingUp,
  Send,
  CheckCheck,
  Calendar,
} from 'lucide-react'
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

interface Summary {
  days: number
  kpis: {
    campaigns_sent: number
    avg_open_rate: number | null
    avg_ctr: number | null
    attributed_bookings: number
  }
  campaigns: Campaign[]
  pagination: { total: number; offset: number; limit: number }
}

const PAGE_SIZE = 20

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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/email-marketing/summary?days=180&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
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
  }, [page])

  if (loading) {
    return <div className="text-sm text-slate-400">{t('common.loading')}</div>
  }

  const empty = !data || data.kpis.campaigns_sent === 0

  if (empty) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <Mail size={32} className="mx-auto text-slate-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">No email campaigns yet</h3>
        <p className="text-sm text-slate-500 mb-4">
          Connect GoHighLevel in Settings to view email analytics.
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

  const totalPages = Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Campaigns Sent" value={fmtInt(data.kpis.campaigns_sent)} icon={Send} />
        <KpiCard
          label="Avg Open Rate"
          value={fmtPct(data.kpis.avg_open_rate)}
          icon={CheckCheck}
        />
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
          Booking attribution is estimated based on UTM parameter matching and may not be 100%
          accurate.
        </span>
      </div>

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
