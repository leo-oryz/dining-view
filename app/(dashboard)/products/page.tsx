'use client'

import { useEffect, useState } from 'react'
import { ProductRanking } from '@/components/charts/ProductRanking'
import { BasketPairs } from '@/components/charts/BasketPairs'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'

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
  const [loading, setLoading] = useState(true)
  const [basketLoading, setBasketLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setBasketLoading(true)

    fetch(`/api/sales/products?start_date=${startDate}&end_date=${endDate}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch(`/api/sales/basket-pairs?start_date=${startDate}&end_date=${endDate}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setBasketData(json.data?.pairs || [])
          setTotalOrders(json.data?.total_orders || 0)
        }
      })
      .catch(() => {})
      .finally(() => setBasketLoading(false))
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
      </div>

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
