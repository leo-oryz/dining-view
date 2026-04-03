'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { format, subDays } from 'date-fns'

const EXPORT_TYPES = [
  { key: 'daily-sales', label: '每日營收', desc: '日期、營收、來客數、訂單數、客單價、翻桌率、新會員、天氣' },
  { key: 'products', label: '商品銷售', desc: '日期、商品名稱、分類、銷量、營收、毛利率' },
  { key: 'orders', label: '訂單明細', desc: '訂單編號、日期、時間、類型、金額、品項數' },
  { key: 'members', label: '會員數據', desc: '日期、總會員數、新會員、回訪率、VIP 分級' },
] as const

export default function ExportPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [fromDate, setFromDate] = useState(thirtyDaysAgo)
  const [toDate, setToDate] = useState(today)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (type: string) => {
    setError(null)
    setLoading(type)

    try {
      const res = await fetch(`/api/export/${type}?from=${fromDate}&to=${toDate}`)

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Export failed')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fnb-pulse-${type}-${fromDate}-${toDate}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">資料匯出</h1>
        <p className="text-sm text-slate-500 mt-1">選擇資料類型和日期範圍，下載 Excel 檔案</p>
      </div>

      {/* Date range picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">日期範圍</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">開始日期</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">結束日期</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              max={today}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">最長可匯出 366 天的資料</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXPORT_TYPES.map((type) => (
          <div
            key={type.key}
            className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between"
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet size={18} className="text-green-600" />
                <h3 className="font-semibold text-slate-900">{type.label}</h3>
              </div>
              <p className="text-xs text-slate-500">{type.desc}</p>
            </div>
            <button
              onClick={() => handleExport(type.key)}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {loading === type.key ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  匯出中...
                </>
              ) : (
                <>
                  <Download size={16} />
                  下載 Excel
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
