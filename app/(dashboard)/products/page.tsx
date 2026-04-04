'use client'

import { useEffect, useState } from 'react'
import { ProductRanking } from '@/components/charts/ProductRanking'
import { BasketPairs } from '@/components/charts/BasketPairs'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'
import { type WeatherDaily } from '@/lib/weather/weatherUtils'

interface ProductSalesData {
  product_name: string
  category: string | null
  quantity_sold: number | null
  revenue: number | null
  gross_margin: number | null
}

interface BasketPairData {
  product_a: string
  product_b: string
  co_occurrence: number
  support_pct: number
}

export default function ProductsPage() {
  const [data, setData] = useState<ProductSalesData[]>([])
  const [basketData, setBasketData] = useState<BasketPairData[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [weatherFilter, setWeatherFilter] = useState<'all' | 'sunny_cloudy' | 'rainy' | 'typhoon'>('all')
  const [weatherData, setWeatherData] = useState<WeatherDaily[]>([])
  const [loading, setLoading] = useState(true)
  const [basketLoading, setBasketLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setBasketLoading(true)

    Promise.all([
      fetch(`/api/sales/products?start_date=${startDate}&end_date=${endDate}`).then(r => r.json()),
      fetch(`/api/sales/basket-pairs?start_date=${startDate}&end_date=${endDate}`).then(r => r.json()),
      fetch(`/api/weather/range?from=${startDate}&to=${endDate}`).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([prodJson, basketJson, weatherJson]) => {
      if (prodJson.success) setData(prodJson.data || [])
      if (basketJson.success) {
        setBasketData(basketJson.data?.pairs || [])
        setTotalOrders(basketJson.data?.total_orders || 0)
      }
      if (weatherJson.success) setWeatherData(weatherJson.data || [])
    }).catch(() => {}).finally(() => {
      setLoading(false)
      setBasketLoading(false)
    })
  }, [startDate, endDate])

  const daySpan = differenceInDays(parseISO(endDate), parseISO(startDate))

  return (
    <div className="space-y-6">
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
        {weatherData.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">天氣</label>
            <select
              value={weatherFilter}
              onChange={(e) => setWeatherFilter(e.target.value as typeof weatherFilter)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部天氣</option>
              <option value="sunny_cloudy">☀️ 晴天/多雲</option>
              <option value="rainy">🌧 雨天</option>
              <option value="typhoon">🌀 颱風日</option>
            </select>
          </div>
        )}
      </div>

      {weatherFilter === 'typhoon' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
          颱風日數據僅供參考
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="text-base font-semibold text-slate-900">商品銷售排行</h3>
          <span className="text-xs text-slate-400">商品名稱以 eat365 報表語言顯示</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            載入中...
          </div>
        ) : (
          <ProductRanking data={data} />
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="text-base font-semibold text-slate-900">商品組合分析</h3>
          <span className="text-xs text-slate-400">常一起被點購的商品組合</span>
        </div>
        {daySpan < 14 && (
          <p className="text-xs text-amber-600 mb-3">
            建議選擇至少 30 天的範圍以獲得更準確的組合分析
          </p>
        )}
        {basketLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            載入中...
          </div>
        ) : (
          <BasketPairs data={basketData} totalOrders={totalOrders} />
        )}
      </div>
    </div>
  )
}
