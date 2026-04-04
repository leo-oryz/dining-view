'use client'

import { useState, useEffect, useCallback } from 'react'
import { Truck, Upload, RefreshCw } from 'lucide-react'
import { format, subDays } from 'date-fns'
import {
  LineChart, ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { type WeatherDaily, isTyphoon, buildWeatherMap } from '@/lib/weather/weatherUtils'

interface DeliveryKpis {
  total_gross_revenue: number
  total_net_revenue: number
  total_orders: number
  avg_commission_rate: number
  avg_cancellation_rate: number
  avg_rating: number | null
}

interface ComparisonRow {
  date: string
  dine_in_revenue: number
  delivery_revenue: number
  total_revenue: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DeliveryRow { [key: string]: any }

export default function DeliveryPage() {
  const [kpis, setKpis] = useState<DeliveryKpis | null>(null)
  const [delivery, setDelivery] = useState<DeliveryRow[]>([])
  const [comparison, setComparison] = useState<ComparisonRow[]>([])
  const [weatherData, setWeatherData] = useState<WeatherDaily[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<string | null>(null)

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, wRes] = await Promise.all([
        fetch(`/api/delivery/summary?start_date=${startDate}&end_date=${endDate}`),
        fetch(`/api/weather/range?from=${startDate}&to=${endDate}`).catch(() => null),
      ])
      const json = await res.json()
      if (json.success) {
        setKpis(json.data.kpis)
        setDelivery(json.data.delivery)
        setComparison(json.data.comparison)
      }
      if (wRes) {
        const wJson = await wRes.json()
        if (wJson.success) setWeatherData(wJson.data || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/uber-eats', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setUploadResult(`成功匯入 ${json.data.imported} 筆資料`)
        fetchData()
      } else {
        setUploadResult(`錯誤：${json.error}`)
      }
    } catch {
      setUploadResult('上傳失敗')
    }
    setUploading(false)
    e.target.value = ''
  }

  const hasData = delivery.length > 0

  // Chart data for delivery trends
  const wMap = buildWeatherMap(weatherData)
  const hasWeather = weatherData.length > 0

  const trendData = delivery
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(d => {
      const dateStr = String(d.date)
      const w = wMap.get(dateStr)
      return {
        rawDate: dateStr,
        date: format(new Date(dateStr), 'M/d'),
        gross: Number(d.gross_revenue) || 0,
        net: Number(d.net_revenue) || 0,
        orders: Number(d.order_count) || 0,
        cancel: Number(d.cancellation_rate) * 100 || 0,
        rating: Number(d.platform_rating) || 0,
        precipitation: w?.precipitation ?? null,
      }
    })

  const typhoonDays = trendData.filter(d => {
    const w = wMap.get(d.rawDate)
    return w && isTyphoon(w)
  })

  const comparisonData = comparison.map(c => ({
    date: format(new Date(c.date), 'M/d'),
    dine_in: c.dine_in_revenue,
    delivery: c.delivery_revenue,
  }))

  return (
    <div className="space-y-6">
      {/* Header with upload */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-orange-600" />
          <h3 className="text-base font-semibold text-slate-900">外送平台</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-green-700 transition">
            <Upload size={16} />
            {uploading ? '上傳中...' : '上傳 Uber Eats CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <button onClick={fetchData} className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className={`text-sm px-4 py-2 rounded-lg ${uploadResult.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {uploadResult}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">載入中...</div>
      ) : !hasData ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Truck size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm text-amber-800 font-medium">尚無外送數據</p>
          <p className="text-xs text-amber-600 mt-1">
            請從 Uber Eats 商家後台匯出 CSV 報表後上傳
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              title="總營收 (毛)"
              value={`NT$${(kpis?.total_gross_revenue || 0).toLocaleString()}`}
            />
            <KpiCard
              title="淨收入"
              value={`NT$${(kpis?.total_net_revenue || 0).toLocaleString()}`}
            />
            <KpiCard
              title="總訂單"
              value={(kpis?.total_orders || 0).toLocaleString()}
            />
            <KpiCard
              title="平均佣金率"
              value={`${((kpis?.avg_commission_rate || 0) * 100).toFixed(1)}%`}
            />
            <KpiCard
              title="取消率"
              value={`${((kpis?.avg_cancellation_rate || 0) * 100).toFixed(1)}%`}
            />
            <KpiCard
              title="平台評分"
              value={kpis?.avg_rating ? kpis.avg_rating.toFixed(1) : '—'}
            />
          </div>

          {/* Gross vs Net Revenue */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">毛營收 vs 淨收入趨勢</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip formatter={(val) => [`NT$${Number(val).toLocaleString()}`]} />
                <Legend />
                <Line type="monotone" dataKey="gross" name="毛營收" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="net" name="淨收入" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Order Count Trend + Weather */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">訂單數趨勢</h4>
            {hasWeather && (
              <p className="text-xs text-slate-400 mb-4">
                下雨天外送訂單通常增加 20-40%，高降雨量日的數據可作為備貨參考
              </p>
            )}
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                {hasWeather && (
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                )}
                <Tooltip
                  formatter={(value, name) => {
                    if (name === '降雨量') return [`${value}mm`, name]
                    return [value, name]
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="orders" name="訂單數" fill="#6366f1" radius={[4, 4, 0, 0]} />
                {hasWeather && (
                  <Bar yAxisId="right" dataKey="precipitation" name="降雨量" fill="#93c5fd" opacity={0.4} radius={[2, 2, 0, 0]} />
                )}
                {typhoonDays.map(d => (
                  <ReferenceLine key={d.rawDate} yAxisId="left" x={d.date} stroke="#ef4444" strokeWidth={2} label={{ value: '颱風', position: 'top', fontSize: 11, fill: '#ef4444' }} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Dine-in vs Delivery Comparison */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">內用 vs 外送營收比較</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip formatter={(val) => [`NT$${Number(val).toLocaleString()}`]} />
                <Legend />
                <Bar dataKey="dine_in" name="內用" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="revenue" />
                <Bar dataKey="delivery" name="外送" fill="#f97316" radius={[4, 4, 0, 0]} stackId="revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cancellation Rate & Rating */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">取消率趨勢</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="%" />
                  <Tooltip formatter={(val) => [`${Number(val).toFixed(1)}%`, '取消率']} />
                  <Line type="monotone" dataKey="cancel" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-4">平台評分趨勢</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[0, 5]} />
                  <Tooltip formatter={(val) => [Number(val).toFixed(1), '評分']} />
                  <Line type="monotone" dataKey="rating" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
