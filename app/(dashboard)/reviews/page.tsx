'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Legend,
} from 'recharts'
import { Star, TrendingDown, MessageSquare, AlertTriangle, TrendingUp, Minus } from 'lucide-react'
import clsx from 'clsx'
import { useI18n } from '@/lib/i18n/context'

type TimeRange = '1m' | '3m' | '6m' | 'all'
type Granularity = 'week' | 'month'

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return formatLocalDate(d)
}

function getStartDate(range: TimeRange): string | null {
  if (range === 'all') return null
  const now = new Date()
  const months = range === '1m' ? 1 : range === '3m' ? 3 : 6
  now.setMonth(now.getMonth() - months)
  return formatLocalDate(now)
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
  const { t } = useI18n()

  const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
    { value: '1m', label: t('reviews.last1Month') },
    { value: '3m', label: t('reviews.last3Months') },
    { value: '6m', label: t('reviews.last6Months') },
    { value: 'all', label: t('reviews.all') },
  ]

  const sentimentLabel: Record<string, string> = {
    improving: t('reviews.improving'),
    stable: t('reviews.stable'),
    declining: t('reviews.declining'),
  }
  const sentimentColor: Record<string, string> = {
    improving: 'text-green-600',
    stable: 'text-slate-600',
    declining: 'text-red-600',
  }

  const [reviews, setReviews] = useState<Review[]>([])
  const [latestSummary, setLatestSummary] = useState<Snapshot | null>(null)
  const [previousSummary, setPreviousSummary] = useState<Snapshot | null>(null)
  const [salesData, setSalesData] = useState<DailySales[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('3m')
  const [granularity, setGranularity] = useState<Granularity>('week')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = getStartDate(timeRange)
      const dateParams = startDate ? `&start_date=${startDate}` : ''

      const noCache = { cache: 'no-store' as RequestCache }
      const [recentRes, summaryRes, salesRes] = await Promise.all([
        fetch(`/api/reviews/recent?limit=200${dateParams}`, noCache),
        fetch('/api/reviews/latest-summary', noCache),
        fetch(`/api/sales/daily?limit=180${dateParams}`, noCache),
      ])

      const [recentJson, summaryJson, salesJson] = await Promise.all([
        recentRes.json(),
        summaryRes.json(),
        salesRes.ok ? salesRes.json() : { data: [] },
      ])

      if (recentJson.success) setReviews(recentJson.data || [])
      if (summaryJson.success) {
        setLatestSummary(summaryJson.data?.latest || null)
        setPreviousSummary(summaryJson.data?.previous || null)
      }
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
  const prev = previousSummary
  const avgRating = latest?.avg_rating ?? null
  const newReviews = latest?.new_reviews_count ?? 0
  const negativeRate = latest && latest.new_reviews_count && latest.new_reviews_count > 0
    ? ((latest.negative_count || 0) / latest.new_reviews_count * 100).toFixed(1)
    : null

  // Previous period values for comparison
  const prevAvgRating = prev?.avg_rating ?? null
  const prevNewReviews = prev?.new_reviews_count ?? null
  const prevNegativeRate = prev && prev.new_reviews_count && prev.new_reviews_count > 0
    ? ((prev.negative_count || 0) / prev.new_reviews_count * 100)
    : null

  // Compute changes
  const ratingChange = avgRating != null && prevAvgRating != null
    ? Number((avgRating - prevAvgRating).toFixed(2))
    : null
  const reviewsChange = prevNewReviews != null
    ? newReviews - prevNewReviews
    : null
  const negRateChange = negativeRate != null && prevNegativeRate != null
    ? Number((Number(negativeRate) - prevNegativeRate).toFixed(1))
    : null

  // Chart data: aggregate reviews by week or month
  const trendData = useMemo(() => {
    const validReviews = reviews.filter(r => r.rating != null && r.review_date)
    if (validReviews.length === 0) return []

    const bucketMap = new Map<string, { ratings: number[]; count: number; negative: number }>()

    for (const r of validReviews) {
      let key: string
      if (granularity === 'month') {
        key = r.review_date.slice(0, 7) // YYYY-MM
      } else {
        key = mondayOf(r.review_date)
      }

      const entry = bucketMap.get(key) || { ratings: [], count: 0, negative: 0 }
      entry.ratings.push(r.rating!)
      entry.count++
      if (r.is_negative) entry.negative++
      bucketMap.set(key, entry)
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({
        label: granularity === 'month' ? key.slice(2) : key.slice(5), // YY-MM or MM-DD
        avg_rating: Number((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2)),
        new_reviews: d.count,
        negative: d.negative,
      }))
  }, [reviews, granularity])

  // Rating vs Revenue dual-axis chart (weekly, built from individual reviews)
  const ratingRevenueData = useMemo(() => buildRatingRevenueData(reviews, salesData), [reviews, salesData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {t('common.loading')}
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
          label={t('reviews.currentRating')}
          value={avgRating != null ? avgRating.toFixed(2) : 'N/A'}
          color="text-yellow-500"
          sub={latest?.total_reviews ? `${t('common.total')} ${latest.total_reviews} ${t('reviews.totalReviews')}` : undefined}
          change={ratingChange}
          changeLabel={ratingChange != null ? `${ratingChange > 0 ? '+' : ''}${ratingChange}` : undefined}
          invertColor={false}
        />
        <KpiCard
          icon={MessageSquare}
          label={t('reviews.weeklyNewReviews')}
          value={String(newReviews)}
          color="text-blue-500"
          change={reviewsChange}
          changeLabel={reviewsChange != null ? `${reviewsChange > 0 ? '+' : ''}${reviewsChange} ${t('reviews.vsLastPeriod')}` : undefined}
          invertColor={false}
        />
        <KpiCard
          icon={TrendingDown}
          label={t('reviews.negativeRate')}
          value={negativeRate != null ? `${negativeRate}%` : 'N/A'}
          color={negativeRate && Number(negativeRate) > 20 ? 'text-red-500' : 'text-slate-500'}
          sub={latest?.negative_count ? `${latest.negative_count} ${t('reviews.negativeReviews')}` : undefined}
          change={negRateChange}
          changeLabel={negRateChange != null ? `${negRateChange > 0 ? '+' : ''}${negRateChange}%` : undefined}
          invertColor={true}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t('reviews.ratingTrend')}
          value={latest?.ai_sentiment_trend ? sentimentLabel[latest.ai_sentiment_trend] || latest.ai_sentiment_trend : 'N/A'}
          color={latest?.ai_sentiment_trend ? sentimentColor[latest.ai_sentiment_trend] || 'text-slate-500' : 'text-slate-500'}
        />
      </div>

      {/* Rating Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            {t('reviews.ratingChart')}
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
                {g === 'week' ? t('reviews.byWeek') : t('reviews.byMonth')}
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
                if (name === t('reviews.avgRating')) return Number(value).toFixed(2)
                return value
              }} />
              <Legend />
              <Bar
                yAxisId="reviews"
                dataKey="new_reviews"
                fill="#93c5fd"
                opacity={0.7}
                name={t('reviews.newReviewCount')}
              />
              <Line
                yAxisId="rating"
                type="monotone"
                dataKey="avg_rating"
                stroke="#eab308"
                strokeWidth={2}
                name={t('reviews.avgRating')}
                dot={{ fill: '#eab308' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            {t('reviews.noRatingData')}
          </div>
        )}
      </div>

      {/* AI Negative Review Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">{t('reviews.aiSummary')}</h3>
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
          <p className="text-sm text-slate-400">{t('reviews.noAiSummary')}</p>
        )}
      </div>

      {/* Recent Reviews List */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          {t('reviews.recentReviews')}
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
                    {r.reviewer_name || t('reviews.anonymous')}
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
          <p className="text-sm text-slate-400">{t('reviews.noReviewData')}</p>
        )}
      </div>

      {/* Rating vs Revenue Dual-Axis Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">{t('reviews.ratingVsRevenue')}</h3>
        {ratingRevenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={ratingRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis yAxisId="rating" domain={[1, 5]} fontSize={12} orientation="left" />
              <YAxis yAxisId="revenue" fontSize={12} orientation="right" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value, name) => {
                const v = Number(value)
                if (name === t('reviews.avgRating')) return v.toFixed(2)
                return `NT$${v.toLocaleString()}`
              }} />
              <Legend />
              <Line
                yAxisId="rating"
                type="monotone"
                dataKey="avg_rating"
                stroke="#eab308"
                strokeWidth={2}
                name={t('reviews.avgRating')}
                dot={{ fill: '#eab308' }}
              />
              <Bar
                yAxisId="revenue"
                dataKey="weekly_revenue"
                fill="#3b82f6"
                opacity={0.6}
                name={t('reviews.weeklyRevenue')}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            {t('reviews.needBothData')}
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
  change,
  changeLabel,
  invertColor,
}: {
  icon: React.ComponentType<Record<string, unknown>>
  label: string
  value: string
  color: string
  sub?: string
  change?: number | null
  changeLabel?: string
  invertColor?: boolean
}) {
  const isPositive = change != null && change > 0
  const isNegative = change != null && change < 0
  const isNeutral = change != null && change === 0

  // For metrics like negative rate, "up" is bad (red) and "down" is good (green)
  const goodColor = 'text-green-600'
  const badColor = 'text-red-600'
  const neutralColor = 'text-slate-400'

  let changeColor = neutralColor
  if (isPositive) changeColor = invertColor ? badColor : goodColor
  if (isNegative) changeColor = invertColor ? goodColor : badColor

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={clsx('text-2xl font-bold', color)}>{value}</div>
      {change != null && changeLabel && (
        <div className={clsx('flex items-center gap-1 mt-1 text-xs font-medium', changeColor)}>
          {isPositive && <TrendingUp size={12} />}
          {isNegative && <TrendingDown size={12} />}
          {isNeutral && <Minus size={12} />}
          <span>{changeLabel}</span>
        </div>
      )}
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

/**
 * Build weekly rating vs revenue data from individual reviews and daily sales.
 */
function buildRatingRevenueData(
  reviews: Review[],
  sales: DailySales[]
): { week: string; avg_rating: number; weekly_revenue: number }[] {
  const validReviews = reviews.filter(r => r.rating != null && r.review_date)
  if (validReviews.length === 0) return []

  // Group reviews by week (Monday-based)
  const weekMap = new Map<string, number[]>()
  for (const r of validReviews) {
    const weekKey = mondayOf(r.review_date)
    const arr = weekMap.get(weekKey) || []
    arr.push(r.rating!)
    weekMap.set(weekKey, arr)
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, ratings]) => {
      const ws = new Date(weekStart + 'T00:00:00')
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      const weekEndStr = formatLocalDate(we)

      const weeklyRevenue = sales
        .filter(d => d.date >= weekStart && d.date <= weekEndStr)
        .reduce((sum, d) => sum + (d.net_sales || 0), 0)

      return {
        week: weekStart.slice(5),
        avg_rating: Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)),
        weekly_revenue: weeklyRevenue,
      }
    })
}
