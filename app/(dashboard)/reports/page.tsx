'use client'

import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

export default function ReportsPage() {
  const { t } = useI18n()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Unknown error' }))
        setError(json.error || 'Failed to generate report')
        setGenerating(false)
        return
      }

      // Download the PDF blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.href = url
      a.download = filenameMatch?.[1] || `diningview-investor-${new Date().toISOString().substring(0, 7)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError(t('reports.generateFailed'))
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-emerald-600" />
        <h3 className="text-base font-semibold text-slate-900">{t('reports.title')}</h3>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="font-semibold text-slate-900 mb-2">{t('reports.subtitle')}</h4>
        <p className="text-sm text-slate-500 mb-6">
          {t('reports.description')}
        </p>

        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <p className="text-xs text-slate-500 font-medium mb-2">{t('reports.contents')}</p>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>1. {t('reports.monthlyRevenue')}</li>
            <li>2. {t('reports.memberGrowth')}</li>
            <li>3. {t('reports.topProducts')}</li>
            <li>4. {t('reports.marginSummary')}</li>
            <li>5. {t('reports.keyKpi')}</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <Download size={18} />
          {generating ? t('reports.generating') : t('reports.download')}
        </button>
      </div>
    </div>
  )
}
