'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useI18n } from '@/lib/i18n/context'

export default function ExportPage() {
  const { t } = useI18n()

  const EXPORT_TYPES = [
    { key: 'daily-sales', label: t('export.dailyRevenue'), desc: t('export.dailyRevenueDesc') },
    { key: 'products', label: t('export.productSales'), desc: t('export.productSalesDesc') },
    { key: 'orders', label: t('export.orderDetails'), desc: t('export.orderDetailsDesc') },
    { key: 'members', label: t('export.memberData'), desc: t('export.memberDataDesc') },
  ] as const

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
        <h1 className="text-xl font-bold text-slate-900">{t('export.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('export.subtitle')}</p>
      </div>

      {/* Date range picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('export.dateRange')}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">{t('export.startDate')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">{t('export.endDate')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              max={today}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">{t('export.maxDays')}</p>
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
                  {t('export.exporting')}
                </>
              ) : (
                <>
                  <Download size={16} />
                  {t('export.downloadExcel')}
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
