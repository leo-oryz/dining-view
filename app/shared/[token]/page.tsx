'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Brain, Loader2 } from 'lucide-react'
import AttributionReportView from '@/components/ai/AttributionReport'
import StarProductsReportView from '@/components/ai/StarProductsReport'
import RetireCandidatesReportView from '@/components/ai/RetireCandidatesReport'
import LaborCostReportView from '@/components/ai/LaborCostReport'
import {
  parseAttributionReport,
  parseStarProductsReport,
  parseRetireCandidatesReport,
  parseLaborCostReport,
} from '@/lib/ai/reportRenderer'

const reportTypeLabels: Record<string, string> = {
  attribution: '營收歸因分析',
  star_products: '明星商品分析',
  retire_candidates: '下架候選分析',
  labor_cost: '人力成本分析',
}

interface SharedReport {
  id: string
  report_type: string
  report_date: string
  period_start: string | null
  period_end: string | null
  content: unknown
  model_used: string | null
  created_at: string
  store_name: string | null
}

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const [report, setReport] = useState<SharedReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/shared/${token}`)
        const json = await res.json()
        if (json.success) {
          setReport(json.data)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchReport()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-500" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Brain size={48} className="mx-auto mb-4 text-slate-300" />
          <h1 className="text-lg font-semibold text-slate-700 mb-1">找不到報告</h1>
          <p className="text-sm text-slate-500">此分享連結無效或已被取消</p>
        </div>
      </div>
    )
  }

  const renderReport = () => {
    if (!report.content) return null
    switch (report.report_type) {
      case 'attribution': {
        const parsed = parseAttributionReport(report.content)
        return parsed ? <AttributionReportView data={parsed} /> : null
      }
      case 'star_products': {
        const parsed = parseStarProductsReport(report.content)
        return parsed ? <StarProductsReportView data={parsed} /> : null
      }
      case 'retire_candidates': {
        const parsed = parseRetireCandidatesReport(report.content)
        return parsed ? <RetireCandidatesReportView data={parsed} /> : null
      }
      case 'labor_cost': {
        const parsed = parseLaborCostReport(report.content)
        return parsed ? <LaborCostReportView data={parsed} /> : null
      }
      default:
        return (
          <pre className="text-xs bg-slate-50 p-4 rounded overflow-auto">
            {JSON.stringify(report.content, null, 2)}
          </pre>
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-purple-50 rounded-full p-2">
            <Brain size={20} className="text-purple-500" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              {reportTypeLabels[report.report_type] || 'AI 分析報告'}
            </h1>
            <p className="text-xs text-slate-500">
              {report.store_name && <span>{report.store_name} · </span>}
              {report.period_start && report.period_end
                ? `${report.period_start} ~ ${report.period_end}`
                : report.report_date}
              <span className="ml-2 text-slate-400">
                產生於 {new Date(report.created_at).toLocaleDateString('zh-TW')}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {renderReport()}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          由 FnB Pulse AI 分析產生
        </p>
      </main>
    </div>
  )
}
