'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { MessageSquare, FileText } from 'lucide-react'
import BroadcastForm from '@/components/line/BroadcastForm'
import FriendTrendChart from '@/components/line/FriendTrendChart'
import BroadcastImpactChart from '@/components/line/BroadcastImpactChart'
import { useI18n } from '@/lib/i18n/context'

interface Broadcast {
  id: string
  broadcast_date: string
  title: string
  message: string | null
  target_audience: string | null
  friend_count_before: number | null
  friend_count_after: number | null
  delivered: number | null
  opened: number | null
  clicked: number | null
  created_at: string
}

interface FriendTrendPoint {
  date: string
  friends: number
  has_broadcast: boolean
}

interface ImpactRow {
  broadcast_title: string
  broadcast_date: string
  avg_before: number
  d1_revenue: number | null
  d2_revenue: number | null
  d3_revenue: number | null
}

type TimeRange = '7d' | '30d' | '90d'

const DAYS_MAP: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default function LinePage() {
  const { t } = useI18n()

  const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7 ' + t('trends.7days').replace('7 ', '') },
    { value: '30d', label: '30 ' + t('trends.30days').replace('30 ', '') },
    { value: '90d', label: '90 ' + t('trends.90days').replace('90 ', '') },
  ]

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [friendTrend, setFriendTrend] = useState<FriendTrendPoint[]>([])
  const [impact, setImpact] = useState<ImpactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const days = DAYS_MAP[timeRange]
      const [bRes, ftRes, impRes] = await Promise.all([
        fetch('/api/line/broadcasts'),
        fetch(`/api/line/friend-trend?days=${days}`),
        fetch('/api/line/broadcast-impact'),
      ])
      const [bJson, ftJson, impJson] = await Promise.all([
        bRes.json(), ftRes.json(), impRes.json(),
      ])
      if (bJson.success) setBroadcasts(bJson.data || [])
      if (ftJson.success) setFriendTrend(ftJson.data || [])
      if (impJson.success) setImpact(impJson.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter out auto-synced follower snapshots from the table display
  // Also filter by time range
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DAYS_MAP[timeRange])
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const displayBroadcasts = broadcasts.filter(
    b => b.title !== '__follower_snapshot__' && b.broadcast_date >= cutoffStr
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-green-600" />
          <h3 className="text-base font-semibold text-slate-900">{t('line.title')}</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
            showForm
              ? 'bg-slate-200 text-slate-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          <FileText size={14} />
          {showForm ? t('common.cancel') : t('line.addRecord')}
        </button>
      </div>

      {/* Time range selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timeRange === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {t('line.autoSyncNote')} · <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-full align-middle" /> = {t('line.hasBroadcast')}
        </p>
      </div>

      {/* Form */}
      {showForm && <BroadcastForm onCreated={() => { setShowForm(false); fetchData() }} />}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('line.friendsTrend')}</h4>
          <FriendTrendChart data={friendTrend} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('line.broadcastRevenue')}</h4>
          <BroadcastImpactChart data={impact} />
        </div>
      </div>

      {/* Broadcast list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">{t('line.broadcastRecords')}</h4>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : displayBroadcasts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('line.noRecords')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('common.date')}</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">{t('line.titleColumn')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">{t('line.delivered')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">{t('line.opened')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">{t('line.clicked')}</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">{t('line.friendCount')}</th>
                </tr>
              </thead>
              <tbody>
                {displayBroadcasts.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500">
                      {format(new Date(b.broadcast_date), 'yyyy/M/d')}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{b.title}</td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {b.delivered?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {b.opened?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 hidden sm:table-cell">
                      {b.clicked?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">
                      {b.friend_count_after?.toLocaleString() ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
