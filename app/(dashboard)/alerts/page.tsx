'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Bell, AlertTriangle, Plane, CalendarHeart, TrendingDown, UserX, Users, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useI18n, type TranslationKey } from '@/lib/i18n/context'

type AlertType = 'flight_spike' | 'holiday_peak' | 'revenue_drop' | 'no_show_spike' | 'low_covers'

type FilterKey = 'all' | 'unread' | AlertType

interface AlertHistoryItem {
  id: string
  store_id: string | null
  alert_type: AlertType
  triggered_at: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
}

interface AlertHistoryResponse {
  items: AlertHistoryItem[]
  page: number
  pageSize: number
  total: number
}

const ALERT_TYPE_META: Record<AlertType, { icon: typeof Plane; badgeBg: string; badgeText: string; cardAccent: string }> = {
  flight_spike: {
    icon: Plane,
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    cardAccent: 'bg-amber-50',
  },
  holiday_peak: {
    icon: CalendarHeart,
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    cardAccent: 'bg-blue-50',
  },
  revenue_drop: {
    icon: TrendingDown,
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    cardAccent: 'bg-red-50',
  },
  no_show_spike: {
    icon: UserX,
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    cardAccent: 'bg-orange-50',
  },
  low_covers: {
    icon: Users,
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    cardAccent: 'bg-purple-50',
  },
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return new Date(iso).toLocaleString()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function AlertsPage() {
  const { t } = useI18n()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AlertHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const filterTabs: { key: FilterKey; labelKey: TranslationKey }[] = [
    { key: 'all', labelKey: 'alerts.all' },
    { key: 'unread', labelKey: 'alerts.unread' },
    { key: 'flight_spike', labelKey: 'alerts.types.flight_spike' },
    { key: 'holiday_peak', labelKey: 'alerts.types.holiday_peak' },
    { key: 'revenue_drop', labelKey: 'alerts.types.revenue_drop' },
    { key: 'no_show_spike', labelKey: 'alerts.types.no_show_spike' },
    { key: 'low_covers', labelKey: 'alerts.types.low_covers' },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (filter === 'unread') params.set('unread', 'true')
      const res = await fetch(`/api/alerts?${params.toString()}`)
      const json = await res.json()
      if (json.success) setData(json.data as AlertHistoryResponse)
      else setData({ items: [], page: 1, pageSize: 20, total: 0 })
    } catch {
      setData({ items: [], page: 1, pageSize: 20, total: 0 })
    }
    setLoading(false)
  }, [page, filter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [filter])

  const visibleItems = useMemo(() => {
    if (!data) return []
    if (filter === 'all' || filter === 'unread') return data.items
    return data.items.filter((i) => i.alert_type === filter)
  }, [data, filter])

  const handleMarkRead = async (id: string) => {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, is_read: true } : i)) } : prev,
    )
    try {
      await fetch(`/api/alerts/${id}/read`, { method: 'PATCH' })
    } catch {
      // optimistic — leave UI as-is
    }
  }

  const handleRunCheck = async () => {
    setRunning(true)
    setMsg(null)
    try {
      const res = await fetch('/api/alerts/run', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setMsg({ text: t('alerts.checkDone'), type: 'success' })
        await load()
      } else {
        setMsg({ text: `${t('alerts.checkFailed')}: ${json.error ?? ''}`, type: 'error' })
      }
    } catch {
      setMsg({ text: t('alerts.checkFailed'), type: 'error' })
    }
    setRunning(false)
  }

  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-amber-600" />
          <h3 className="text-base font-semibold text-slate-900">{t('alerts.title')}</h3>
        </div>
        <button
          onClick={handleRunCheck}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
          {running ? t('alerts.checking') : t('alerts.runCheck')}
        </button>
      </div>

      {msg && (
        <div
          className={`text-sm px-4 py-2 rounded-lg ${
            msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-full border transition ${
              filter === tab.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : visibleItems.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm text-slate-500">{t('alerts.empty')} 🎉</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleItems.map((alert) => {
              const meta = ALERT_TYPE_META[alert.alert_type] ?? ALERT_TYPE_META.revenue_drop
              const Icon = meta.icon
              const labelKey = `alerts.types.${alert.alert_type}` as TranslationKey
              return (
                <li
                  key={alert.id}
                  className={`px-5 py-4 flex items-start gap-4 ${alert.is_read ? 'opacity-70' : 'border-l-4 border-l-amber-400'}`}
                >
                  <div className={`p-2 rounded-lg ${meta.cardAccent}`}>
                    <Icon size={16} className={meta.badgeText} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${meta.badgeBg} ${meta.badgeText}`}
                      >
                        {t(labelKey)}
                      </span>
                      <span className="text-xs text-slate-400" title={new Date(alert.triggered_at).toLocaleString()}>
                        {formatRelative(alert.triggered_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900 break-words">{alert.message}</p>
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors whitespace-nowrap"
                    >
                      {t('alerts.markAsRead')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!loading && total > pageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            <div>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50"
              >
                {t('alerts.prev')}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50"
              >
                {t('alerts.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {visibleItems.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>
            Alerts are evaluated against your active alert rules. Configure rules and thresholds in Settings →
            Intelligence.
          </span>
        </div>
      )}
    </div>
  )
}
