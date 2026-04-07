'use client'

import { useEffect, useState } from 'react'
import { ProductRanking } from '@/components/charts/ProductRanking'
import { BasketPairs } from '@/components/charts/BasketPairs'
import { ProductAnomalyTab } from '@/components/charts/ProductAnomalyTab'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'
import { type WeatherDaily } from '@/lib/weather/weatherUtils'
import { useI18n } from '@/lib/i18n/context'

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

type Tab = 'ranking' | 'anomaly'

export default function ProductsPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<Tab>('ranking')
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
    if (activeTab !== 'ranking') return

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
  }, [startDate, endDate, activeTab])

  const daySpan = differenceInDays(parseISO(endDate), parseISO(startDate))

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            activeTab === 'ranking'
              ? 'bg-white text-slate-900 font-medium shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('products.title')}
        </button>
        <button
          onClick={() => setActiveTab('anomaly')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            activeTab === 'anomaly'
              ? 'bg-white text-slate-900 font-medium shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('products.anomaly')}
        </button>
      </div>

      {activeTab === 'ranking' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500">{t('common.from')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500">{t('common.to')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {weatherData.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">{t('products.weather')}</label>
                <select
                  value={weatherFilter}
                  onChange={(e) => setWeatherFilter(e.target.value as typeof weatherFilter)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t('products.allWeather')}</option>
                  <option value="sunny_cloudy">☀️ {t('products.sunny')}</option>
                  <option value="rainy">🌧 {t('products.rainy')}</option>
                  <option value="typhoon">🌀 {t('products.typhoonDay')}</option>
                </select>
              </div>
            )}
          </div>

          {weatherFilter === 'typhoon' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
              {t('products.typhoonDisclaimer')}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-baseline gap-2 mb-4">
              <h3 className="text-base font-semibold text-slate-900">{t('products.salesRanking')}</h3>
              <span className="text-xs text-slate-400">{t('products.nameDisclaimer')}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                {t('common.loading')}
              </div>
            ) : (
              <ProductRanking data={data} />
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-baseline gap-2 mb-4">
              <h3 className="text-base font-semibold text-slate-900">{t('products.comboAnalysis')}</h3>
              <span className="text-xs text-slate-400">{t('products.comboDescription')}</span>
            </div>
            {daySpan < 14 && (
              <p className="text-xs text-amber-600 mb-3">
                {t('products.comboSuggestion')}
              </p>
            )}
            {basketLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                {t('common.loading')}
              </div>
            ) : (
              <BasketPairs data={basketData} totalOrders={totalOrders} />
            )}
          </div>
        </>
      )}

      {activeTab === 'anomaly' && (
        <ProductAnomalyTab />
      )}
    </div>
  )
}
