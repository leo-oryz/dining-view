'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Camera,
  Music2,
  BookOpen,
  Users,
  Eye,
  TrendingUp,
  Activity,
  Plus,
  ThumbsUp,
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
} from 'recharts'
import XhsManualInputForm from '@/components/social/XhsManualInputForm'
import { useI18n } from '@/lib/i18n/context'

type Platform = 'instagram' | 'facebook' | 'tiktok' | 'xiaohongshu'

interface DailyPoint {
  date: string
  followers: number | null
  reach: number | null
  impressions: number | null
  profile_visits: number | null
  website_clicks: number | null
}

interface PostRow {
  post_id: string
  post_type: string | null
  posted_at: string | null
  caption_snippet: string | null
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  impressions: number
  views: number
}

interface SocialSummary {
  platform: Platform
  days: number
  kpis?: {
    followers: number | null
    followers_prev: number | null
    total_reach: number
    total_impressions: number
    avg_engagement_rate: number | null
  }
  daily?: DailyPoint[]
  top_posts?: PostRow[]
  manual_entries?: {
    date: string
    followers: number | null
    total_likes: number | null
    total_comments: number | null
    top_post_title: string | null
    top_post_views: number | null
    notes: string | null
  }[]
}

const PLATFORMS: { key: Platform; label: string; icon: typeof Camera; tone: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: Camera, tone: 'text-pink-500' },
  { key: 'facebook', label: 'Facebook', icon: ThumbsUp, tone: 'text-blue-500' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, tone: 'text-slate-700' },
  { key: 'xiaohongshu', label: '小紅書', icon: BookOpen, tone: 'text-rose-500' },
]

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(2)}%`
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return '—'
  return Math.round(v).toLocaleString('en-US')
}

function fmtDelta(curr: number | null, prev: number | null): string {
  if (curr == null || prev == null || prev === 0) return ''
  const diff = curr - prev
  const pct = Math.round((diff / prev) * 1000) / 10
  const sign = diff > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export default function SocialDashboardPage() {
  const { t } = useI18n()
  const [active, setActive] = useState<Platform>('instagram')
  const [data, setData] = useState<SocialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showXhsForm, setShowXhsForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/social/summary?platform=${active}&days=30`)
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
  }, [active, refreshKey])

  const current = PLATFORMS.find((p) => p.key === active)!

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {PLATFORMS.map((p) => {
          const Icon = p.icon
          const isActive = p.key === active
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setActive(p.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : p.tone} />
              {p.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common.loading')}</div>
      ) : active === 'xiaohongshu' ? (
        <XhsTab
          entries={data?.manual_entries ?? []}
          onAdd={() => setShowXhsForm(true)}
          showForm={showXhsForm}
          onClose={() => setShowXhsForm(false)}
          onSaved={() => {
            setShowXhsForm(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      ) : !data?.kpis || (data.daily?.length === 0 && (data.top_posts ?? []).length === 0) ? (
        <EmptyState platform={current.label} />
      ) : (
        <PlatformView data={data} platformLabel={current.label} />
      )}
    </div>
  )
}

function EmptyState({ platform }: { platform: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <Activity size={32} className="mx-auto text-slate-400 mb-3" />
      <h3 className="text-base font-semibold text-slate-900 mb-1">No {platform} data yet</h3>
      <p className="text-sm text-slate-500 mb-4">
        Connect {platform} in Settings to view analytics.
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

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Users
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
        <Icon size={20} className="text-slate-400" />
      </div>
    </div>
  )
}

function PlatformView({ data, platformLabel }: { data: SocialSummary; platformLabel: string }) {
  const kpis = data.kpis!
  const daily = data.daily ?? []
  const topPosts = data.top_posts ?? []
  const wow = fmtDelta(kpis.followers, kpis.followers_prev)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Followers"
          value={fmtInt(kpis.followers)}
          hint={wow ? `${wow} WoW` : undefined}
          icon={Users}
        />
        <KpiCard label={`Reach (${data.days}d)`} value={fmtInt(kpis.total_reach)} icon={Eye} />
        <KpiCard
          label={`Impressions (${data.days}d)`}
          value={fmtInt(kpis.total_impressions)}
          icon={TrendingUp}
        />
        <KpiCard
          label="Avg Engagement Rate"
          value={fmtPct(kpis.avg_engagement_rate)}
          icon={Activity}
        />
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Followers & Reach Trend</h3>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          {daily.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">No daily data in this period</p>
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="followers"
                    stroke="#3b82f6"
                    name="Followers"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="reach"
                    stroke="#ec4899"
                    name="Reach"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Top Posts ({platformLabel})
        </h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          {topPosts.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No posts available</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Caption</th>
                  <th className="px-4 py-2 text-right">Likes</th>
                  <th className="px-4 py-2 text-right">Comments</th>
                  <th className="px-4 py-2 text-right">Saves/Shares</th>
                  <th className="px-4 py-2 text-right">Reach</th>
                  <th className="px-4 py-2 text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topPosts.map((p) => (
                  <tr key={p.post_id}>
                    <td className="px-4 py-2 text-slate-600">
                      {p.posted_at ? new Date(p.posted_at).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{p.post_type ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-700 max-w-xs truncate">
                      {p.caption_snippet ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right">{fmtInt(p.likes)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(p.comments)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt((p.saves ?? 0) + (p.shares ?? 0))}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(p.reach)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}

interface XhsEntry {
  date: string
  followers: number | null
  total_likes: number | null
  total_comments: number | null
  top_post_title: string | null
  top_post_views: number | null
  notes: string | null
}

function XhsTab({
  entries,
  onAdd,
  showForm,
  onClose,
  onSaved,
}: {
  entries: XhsEntry[]
  onAdd: () => void
  showForm: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const ascending = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700"
        >
          <Plus size={14} />
          Add Weekly Entry
        </button>
      </div>

      {showForm && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <XhsManualInputForm onSaved={onSaved} />
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Followers Trend (manual)</h3>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          {ascending.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">No manual entries yet</p>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ascending}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="followers" stroke="#f43f5e" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Entries</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No manual entries yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Followers</th>
                  <th className="px-4 py-2 text-right">Likes</th>
                  <th className="px-4 py-2 text-right">Comments</th>
                  <th className="px-4 py-2 text-left">Top Post</th>
                  <th className="px-4 py-2 text-right">Top Views</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.date}>
                    <td className="px-4 py-2 text-slate-600">{e.date}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(e.followers)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(e.total_likes)}</td>
                    <td className="px-4 py-2 text-right">{fmtInt(e.total_comments)}</td>
                    <td className="px-4 py-2 text-slate-700 max-w-xs truncate">
                      {e.top_post_title ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right">{fmtInt(e.top_post_views)}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-xs truncate">
                      {e.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}
