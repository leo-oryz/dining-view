'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Legend,
} from 'recharts'
import { Star, TrendingDown, MessageSquare, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

type TimeRange = '1m' | '3m' | '6m' | 'all'
type Granularity = 'week' | 'month'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1m', label: '近 1 個月' },
  { value: '3m', label: '近 3 個月' },
  { value: '6m', label: '近 6 個月' },
  { value: 'all', label: '全部' },
]

function getStartDate(range: TimeRange): string | null {
  if (range === 'all') return null
  const now = new Date()
  const months = range === '1m' ? 1 : range === '3m' ? 3 : 6
  now.setMonth(now.getMonth() - months)
  return now.toISOString().split('T')[0]
}

interface Snapshot {
  snapshot_date: string
  total_reviews: number
  avg_rating: number | null
  new_reviews_count: number
  negative_count: number
  rating_breakdown: Record<string, number> | null
  ai_negative_summary: string | null
  ai_sentiment_trend: string | null
  keywords: string[] | null
}

interface Review {
  id: string
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  review_date: string
  is_negative: boolean
}

interface DailySales {
  date: string
  net_sales: number | null
}

export default function ReviewsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [latestSummary, setLatestSummary] = useState<Snapshot | null>(null)
  const [salesData, setSalesData] = useState<DailySales[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('3m')
  const [granularity, setGranularity] = useState<Granularity>('week')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = getStartDate(timeRange)
      const dateParams = startDate ? `&start_date=${startDate}` : ''

      const [snapshotsRes, recentRes, summaryRes, salesRes] = await Promise.all([
        fetch(`/api/reviews/snapshots?limit=200${dateParams}`),
        fetch(`/api/reviews/recent?limit=200${dateParams}`),
        fetch('/api/reviews/latest-summary'),
        fetch('/api/sales/daily?limit=180'),
      ])

      const [snapshotsJson, recentJson, summaryJson, salesJson] = await Promise.all([
        snapshotsRes.json(),
        recentRes.json(),
        summaryRes.json(),
        salesRes.ok ? salesRes.json() : { data: [] },
      ])

      if (snapshotsJson.success) setSnapshots(snapshotsJson.data || [])
      if (recentJson.success) setReviews(recentJson.data || [])
      if (summaryJson.success) setLatestSummary(summaryJson.data)
      if (salesJson.success) setSalesData(salesJson.data || [])
    } catch (err) {
      console.error('Failed to fetch reviews data:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Latest snapshot for KPIs
  const latest = latestSummary
  const avgRating = latest?.avg_rating ?? null
  const newReviews = latest?.new_reviews_count ?? 0
  const negativeRate = latest && latest.new_reviews_count && latest.new_reviews_count > 0
    ? ((latest.negative_count || 0) / latest.new_reviews_count * 100).toFixed(1)
    : null

  // Chart data: snapshots sorted chronologically, with week/month aggregation
  const trendData = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

    if (granularity === 'week') {
      return sorted.map(s => ({
        label: s.snapshot_date.slice(5), // MM-DD
        avg_rating: s.avg_rating ? Number(s.avg_rating) : null,
        new_reviews: s.new_reviews_count,
        negative: s.negative_count,
      }))
    }

    // Monthly aggregation
    const monthMap = new Map<string, { ratings: number[]; reviews: number; negative: number }>()
    for (const s of sorted) {
      const monthKey = s.snapshot_date.slice(0, 7) // YYYY-MM
      const entry = monthMap.get(monthKey) || { ratings: [], reviews: 0, negative: 0 }
      if (s.avg_rating) entry.ratings.push(Number(s.avg_rating))
      entry.reviews += s.new_reviews_count
      entry.negative += s.negative_count
      monthMap.set(monthKey, entry)
    }

    return Array.from(monthMap.entries()).map(([month, d]) => ({
      label: month.slice(2), // YY-MM
      avg_rating: d.ratings.length > 0 ? Number((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2)) : null,
      new_reviews: d.reviews,
      negative: d.negative,
    }))
  }, [snapshots, granularity])

  // Rating vs Revenue dual-axis chart
  const ratingRevenueData = buildRatingRevenueData(snapshots, salesData)

  const sentimentLabel: Record<string, string> = {
    improving: '改善中',
    stable: '穩定',
    declining: '下滑中',
  }
  const sentimentColor: Record<string, string> = {
    improving: 'text-green-600',
    stable: 'text-slate-600',
    declining: 'text-red-600',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        載入中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
          {TIME_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                timeRange === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Star}
          label="目前評分"
          value={avgRating != null ? avgRating.toFixed(2) : 'N/A'}
          color="text-yellow-500"
          sub={latest?.total_reviews ? `共 ${latest.total_reviews} 則評論` : undefined}
        />
        <KpiCard
          icon={MessageSquare}
          label="本週新評論"
          value={String(newReviews)}
          color="text-blue-500"
        />
        <KpiCard
          icon={TrendingDown}
          label="負評率"
          value={negativeRate != null ? `${negativeRate}%` : 'N/A'}
          color={negativeRate && Number(negativeRate) > 20 ? 'text-red-500' : 'text-slate-500'}
          sub={latest?.negative_count ? `${latest.negative_count} 則負評` : undefined}
        />
        <KpiCard
          icon={AlertTriangle}
          label="評價趨勢"
          value={latest?.ai_sentiment_trend ? sentimentLabel[latest.ai_sentiment_trend] || latest.ai_sentiment_trend : 'N/A'}
          color={latest?.ai_sentiment_trend ? sentimentColor[latest.ai_sentiment_trend] || 'text-slate-500' : 'text-slate-500'}
        />
      </div>

      {/* Rating Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            評分趨勢
          </h3>
          <div className="flex bg-slate-100 rounded-md p-0.5">
            {(['week', 'month'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={clsx(
                  'px-3 py-1 text-xs rounded transition-colors',
                  granularity === g
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {g === 'week' ? '按週' : '按月'}
              </button>
            ))}
          </div>
        </div>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis yAxisId="rating" domain={[1, 5]} fontSize={12} orientation="left" />
              <YAxis yAxisId="reviews" fontSize={12} orientation="right" />
              <Tooltip formatter={(value, name) => {
                if (name === '平均評分') return Number(value).toFixed(2)
                return value
              }} />
              <Legend />
              <Bar
                yAxisId="reviews"
                dataKey="new_reviews"
                fill="#93c5fd"
                opacity={0.7}
                name="新評論數"
              />
              <Line
                yAxisId="rating"
                type="monotone"
                dataKey="avg_rating"
                stroke="#eab308"
                strokeWidth={2}
                name="平均評分"
                dot={{ fill: '#eab308' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            尚無評分數據
          </div>
        )}
      </div>

      {/* AI Negative Review Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">AI 負評摘要</h3>
        {latest?.ai_negative_summary ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              {latest.ai_negative_summary}
            </p>
            {latest.keywords && latest.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {latest.keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">尚無 AI 分析摘要</p>
        )}
      </div>

      {/* Recent Reviews List */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          最近評論
        </h3>
        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div
                key={r.id}
                className={clsx(
                  'border rounded-lg p-3',
                  r.is_negative ? 'border-red-200 bg-red-50' : 'border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-900">
                    {r.reviewer_name || '匿名'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{r.review_date}</span>
                    {r.rating != null && (
                      <span className={clsx(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        r.rating >= 4 ? 'bg-green-100 text-green-700' :
                        r.rating === 3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {r.rating} ★
                      </span>
                    )}
                  </div>
                </div>
                {r.review_text && (
                  <p className="text-sm text-slate-600 line-clamp-3">
                    {r.review_text}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">尚無評論數據</p>
        )}
      </div>

      {/* Rating vs Revenue Dual-Axis Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">評分 vs 業績</h3>
        {ratingRevenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={ratingRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis yAxisId="rating" domain={[1, 5]} fontSize={12} orientation="left" />
              <YAxis yAxisId="revenue" fontSize={12} orientation="right" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value, name) => {
                const v = Number(value)
                if (name === '平均評分') return v.toFixed(2)
                return `NT$${v.toLocaleString()}`
              }} />
              <Legend />
              <Line
                yAxisId="rating"
                type="monotone"
                dataKey="avg_rating"
                stroke="#eab308"
                strokeWidth={2}
                name="平均評分"
                dot={{ fill: '#eab308' }}
              />
              <Bar
                yAxisId="revenue"
                dataKey="weekly_revenue"
                fill="#3b82f6"
                opacity={0.6}
                name="週營收"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            需要評分和營收數據才能顯示
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ComponentType<Record<string, unknown>>
  label: string
  value: string
  color: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={clsx('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

/**
 * Merge weekly snapshots with weekly aggregated sales for dual-axis chart.
 */
function buildRatingRevenueData(
  snapshots: Snapshot[],
  sales: DailySales[]
): { week: string; avg_rating: number; weekly_revenue: number }[] {
  if (snapshots.length === 0) return []

  // Group sales by the closest snapshot week
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  return sorted.map(s => {
    const snapDate = new Date(s.snapshot_date)
    const weekStart = new Date(snapDate)
    weekStart.setDate(weekStart.getDate() - 6)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const weeklyRevenue = sales
      .filter(d => d.date >= weekStartStr && d.date <= s.snapshot_date)
      .reduce((sum, d) => sum + (d.net_sales || 0), 0)

    return {
      week: s.snapshot_date.slice(5),
      avg_rating: s.avg_rating ? Number(s.avg_rating) : 0,
      weekly_revenue: weeklyRevenue,
    }
  }).filter(d => d.avg_rating > 0)
}
