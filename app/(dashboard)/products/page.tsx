'use client'

import { useEffect, useState } from 'react'
import { ProductRanking } from '@/components/charts/ProductRanking'
import { format, subDays } from 'date-fns'

interface ProductSalesData {
  product_name: string
  category: string | null
  quantity_sold: number | null
  revenue: number | null
  gross_margin: number | null
}

export default function ProductsPage() {
  const [data, setData] = useState<ProductSalesData[]>([])
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/sales/products?start_date=${startDate}&end_date=${endDate}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [startDate, endDate])

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
    </div>
  )
}
