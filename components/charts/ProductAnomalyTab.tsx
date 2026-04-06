'use client'

import { useState, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { WEATHER_ICONS, type WeatherType } from '@/lib/weather/weatherUtils'

interface ProductAnomaly {
  product_name: string
  category: string | null
  anomaly_date: string
  anomaly_type: 'spike' | 'drop'
  actual_qty: number
  baseline_qty: number
  delta_pct: number
  weather_type: string
  is_typhoon_day: boolean
  has_campaign: boolean
  campaign_name: string | null
  has_kol: boolean
  kol_name: string | null
}

interface AnomalySummary {
  total: number
  spikes: number
  drops: number
  most_anomalous: string | null
}

interface TrendPoint {
  date: string
  quantity: number
  moving_avg: number | null
  anomaly_type: 'spike' | 'drop' | null
  delta_pct: number | null
  weather_type: string
  weather_icon: string
  has_campaign: boolean
  campaign_name: string | null
  has_kol: boolean
  kol_name: string | null
}

interface TrendData {
  product_name: string
  category: string | null
  trend: TrendPoint[]
}

export function ProductAnomalyTab() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [typeFilter, setTypeFilter] = useState<'all' | 'spike' | 'drop'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [anomalies, setAnomalies] = useState<ProductAnomaly[]>([])
  const [summary, setSummary] = useState<AnomalySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchAnomalies = useCallback(async () => {
    setLoading(true)
    setHasFetched(true)
    try {
      const res = await fetch(
        `/api/products/anomalies?from=${startDate}&to=${endDate}&type=${typeFilter}`
      )
      const json = await res.json()
      if (json.success) {
        setAnomalies(json.data.anomalies || [])
        setSummary(json.data.summary || null)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, typeFilter])

  const fetchTrend = useCallback(async (productName: string) => {
    setTrendLoading(true)
    try {
      const res = await fetch(
        `/api/products/${encodeURIComponent(productName)}/trend?from=${startDate}&to=${endDate}`
      )
      const json = await res.json()
      if (json.success) {
        setTrendData(json.data)
      }
    } catch {
      // silently fail
    } finally {
      setTrendLoading(false)
    }
  }, [startDate, endDate])

  const handleRowClick = (productName: string) => {
    if (expandedProduct === productName) {
      setExpandedProduct(null)
      setTrendData(null)
    } else {
      setExpandedProduct(productName)
      fetchTrend(productName)
    }
  }

  // Get unique categories for filter
  const categories = Array.from(new Set(anomalies.map(a => a.category).filter(Boolean))) as string[]

  // Filter by category
  const filteredAnomalies = categoryFilter === 'all'
    ? anomalies
    : anomalies.filter(a => a.category === categoryFilter)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">從</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">到</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'spike' | 'drop')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全部異常</option>
          <option value="spike">只看上升</option>
          <option value="drop">只看下降</option>
        </select>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部分類</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <button
          onClick={fetchAnomalies}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '分析中...' : '開始偵測'}
        </button>
      </div>

      {!hasFetched && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          選擇日期範圍後點擊「開始偵測」，系統將分析商品銷量異常
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          正在分析商品銷量異常...
        </div>
      )}

      {!loading && hasFetched && (
        <>
          {/* Summary Card */}
          {summary && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">本期異常事件</h4>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-lg">&#x2B06;&#xFE0F;</span>
                  <span className="text-sm text-slate-600">上升異常</span>
                  <span className="text-lg font-bold text-green-700">{summary.spikes}</span>
                  <span className="text-sm text-slate-400">件</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 text-lg">&#x2B07;&#xFE0F;</span>
                  <span className="text-sm text-slate-600">下降異常</span>
                  <span className="text-lg font-bold text-red-700">{summary.drops}</span>
                  <span className="text-sm text-slate-400">件</span>
                </div>
                {summary.most_anomalous && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">最常異常商品：</span>
                    <span className="text-sm font-semibold text-slate-800">{summary.most_anomalous}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Anomaly List */}
          {filteredAnomalies.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
              此期間未偵測到商品銷量異常
            </div>
          )}

          <div className="space-y-2">
            {filteredAnomalies.map((a, idx) => {
              const isSpike = a.anomaly_type === 'spike'
              const isExpanded = expandedProduct === a.product_name && a === filteredAnomalies.find(
                x => x.product_name === a.product_name
              )
              const rowKey = `${a.product_name}-${a.anomaly_date}-${idx}`

              return (
                <div key={rowKey}>
                  <div
                    className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow ${
                      isSpike ? 'border-green-200' : 'border-red-200'
                    }`}
                    onClick={() => handleRowClick(a.product_name)}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Type + Delta */}
                      <span className={`text-sm font-bold ${isSpike ? 'text-green-700' : 'text-red-700'}`}>
                        {isSpike ? '\u2B06\uFE0F' : '\u2B07\uFE0F'} {a.delta_pct > 0 ? '+' : ''}{a.delta_pct}%
                      </span>

                      {/* Product Name */}
                      <span className="text-sm font-semibold text-slate-900">{a.product_name}</span>

                      {/* Date */}
                      <span className="text-xs text-slate-400">{a.anomaly_date}</span>

                      {/* Category */}
                      {a.category && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                          {a.category}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>實際 {a.actual_qty} 份 vs 基準 {a.baseline_qty} 份</span>

                      {/* Weather */}
                      <span>{WEATHER_ICONS[a.weather_type as WeatherType] || '\uD83C\uDF24'} {a.weather_type === 'typhoon' ? '颱風' : ''}</span>

                      {/* Campaign */}
                      {a.has_campaign && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                          \uD83D\uDCE2 {a.campaign_name}
                        </span>
                      )}

                      {/* KOL */}
                      {a.has_kol && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                          \uD83D\uDC64 {a.kol_name}
                        </span>
                      )}

                      {/* Typhoon tag */}
                      {a.is_typhoon_day && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">
                          颱風日 — 異常可能為天氣因素
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Trend Chart */}
                  {isExpanded && expandedProduct === a.product_name && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 mt-1">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{a.product_name}</h4>
                          {a.category && (
                            <span className="text-xs text-slate-400">{a.category}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedProduct(null)
                            setTrendData(null)
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded"
                        >
                          收起
                        </button>
                      </div>

                      {trendLoading ? (
                        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                          載入趨勢圖...
                        </div>
                      ) : trendData ? (
                        <ProductTrendChart data={trendData} />
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** Inline trend chart component */
function ProductTrendChart({ data }: { data: TrendData }) {
  const chartData = data.trend.map(d => ({
    ...d,
    dateLabel: format(new Date(d.date), 'M/d'),
  }))

  const CustomDot = (props: Record<string, unknown>) => {
    const { cx, cy, payload } = props as { cx: number; cy: number; payload: TrendPoint }
    if (!payload.anomaly_type) return null
    const color = payload.anomaly_type === 'spike' ? '#16a34a' : '#dc2626'
    return (
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
    )
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: TrendPoint & { dateLabel: string } }>; label?: string }) => {
    if (!active || !payload || !payload[0]) return null
    const d = payload[0].payload

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
        <div className="font-semibold text-slate-800 mb-1">{label} ({d.date})</div>
        <div className="text-slate-600">銷量：{d.quantity} 份</div>
        {d.moving_avg != null && (
          <div className="text-slate-400">14日均值：{d.moving_avg} 份</div>
        )}
        {d.anomaly_type && (
          <div className={d.anomaly_type === 'spike' ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
            {d.anomaly_type === 'spike' ? '\u2B06\uFE0F' : '\u2B07\uFE0F'} {d.delta_pct! > 0 ? '+' : ''}{d.delta_pct}%
          </div>
        )}
        <div className="mt-1 pt-1 border-t border-slate-100 space-y-0.5">
          <div>{WEATHER_ICONS[d.weather_type as WeatherType] || '\uD83C\uDF24'} {d.weather_type}</div>
          {d.has_campaign && <div>\uD83D\uDCE2 {d.campaign_name}</div>}
          {d.has_kol && <div>\uD83D\uDC64 {d.kol_name}</div>}
        </div>
      </div>
    )
  }

  // Find campaign and KOL reference lines
  const campaignDays = chartData.filter(d => d.has_campaign)
  const kolDays = chartData.filter(d => d.has_kol)

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip content={<CustomTooltip />} />

          {/* Moving average (dashed gray) */}
          <Line
            type="monotone"
            dataKey="moving_avg"
            name="14日移動平均"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
          />

          {/* Daily quantity (blue) */}
          <Line
            type="monotone"
            dataKey="quantity"
            name="每日銷量"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 4 }}
          />

          {/* Campaign day markers */}
          {campaignDays.map(d => (
            <ReferenceLine
              key={`campaign-${d.date}`}
              x={d.dateLabel}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}

          {/* KOL day markers */}
          {kolDays.map(d => (
            <ReferenceLine
              key={`kol-${d.date}`}
              x={d.dateLabel}
              stroke="#8b5cf6"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Context legend below chart */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 px-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
          <span>每日銷量</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-400 inline-block" style={{ borderTop: '1.5px dashed #94a3b8' }}></span>
          <span>14日移動平均</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block"></span>
          <span>上升異常</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
          <span>下降異常</span>
        </div>
        {campaignDays.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-500 inline-block" style={{ borderTop: '1.5px dashed #f59e0b' }}></span>
            <span>\uD83D\uDCE2 促銷活動</span>
          </div>
        )}
        {kolDays.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-purple-500 inline-block" style={{ borderTop: '1.5px dashed #8b5cf6' }}></span>
            <span>\uD83D\uDC64 KOL 發文</span>
          </div>
        )}
      </div>

      {/* Weather row */}
      <div className="flex flex-wrap gap-1 mt-2 px-2">
        {chartData.map(d => (
          <div key={d.date} className="text-center" style={{ minWidth: '28px' }}>
            <div className="text-[10px]">{WEATHER_ICONS[d.weather_type as WeatherType] || '\uD83C\uDF24'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
