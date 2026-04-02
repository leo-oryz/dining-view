'use client'

import { useState, useEffect } from 'react'
import { GitCompareArrows } from 'lucide-react'
import { format, subDays } from 'date-fns'
import StoreCompareTable from '@/components/compare/StoreCompareTable'

interface StoreComparison {
  store_id: string
  store_name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  current: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deltas: any
}

export default function ComparePage() {
  const [stores, setStores] = useState<StoreComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/compare?start_date=${startDate}&end_date=${endDate}`)
      const json = await res.json()
      if (json.success) {
        setStores(json.data.stores || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [startDate, endDate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <GitCompareArrows size={20} className="text-violet-600" />
          <h3 className="text-base font-semibold text-slate-900">跨店對比</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-500">起始</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-500">結束</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">門店 KPI 比較</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {startDate} ~ {endDate} vs 上一同期
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">載入中...</div>
        ) : (
          <StoreCompareTable stores={stores} />
        )}
      </div>
    </div>
  )
}
