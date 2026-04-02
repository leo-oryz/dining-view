'use client'

import { useState } from 'react'
import { FileText, Download } from 'lucide-react'

export default function ReportsPage() {
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
      a.download = filenameMatch?.[1] || `fnb-pulse-investor-${new Date().toISOString().substring(0, 7)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('產生報告失敗，請稍後再試')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-emerald-600" />
        <h3 className="text-base font-semibold text-slate-900">投資人報告</h3>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="font-semibold text-slate-900 mb-2">月度投資人報告 (PDF)</h4>
        <p className="text-sm text-slate-500 mb-6">
          產生包含月營收趨勢、會員成長、熱銷產品、毛利率及關鍵 KPI 的 PDF 報告。
        </p>

        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <p className="text-xs text-slate-500 font-medium mb-2">報告內容</p>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>1. 月營收趨勢 (最近 12 個月)</li>
            <li>2. 會員成長曲線</li>
            <li>3. Top 10 熱銷產品</li>
            <li>4. 毛利率摘要</li>
            <li>5. 關鍵 KPI：客單價、翻桌率、新會員率</li>
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
          {generating ? '產生中...' : '下載投資人報告'}
        </button>
      </div>
    </div>
  )
}
