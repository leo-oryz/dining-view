'use client'

import { useEffect, useState } from 'react'
import { Brain, Loader2, Calendar } from 'lucide-react'
import ReportHistory from '@/components/ai/ReportHistory'
import AttributionReportView from '@/components/ai/AttributionReport'
import StarProductsReportView from '@/components/ai/StarProductsReport'
import RetireCandidatesReportView from '@/components/ai/RetireCandidatesReport'
import {
  ReportRecord,
  ReportType,
  parseAttributionReport,
  parseStarProductsReport,
  parseRetireCandidatesReport,
} from '@/lib/ai/reportRenderer'

const reportTypeOptions: { value: ReportType; label: string; defaultDays: number }[] = [
  { value: 'attribution', label: '營收歸因分析', defaultDays: 30 },
  { value: 'star_products', label: '明星商品分析', defaultDays: 60 },
  { value: 'retire_candidates', label: '下架候選分析', defaultDays: 90 },
]

const RANGE_PRESETS = [
  { label: '近 7 天', days: 7 },
  { label: '近 30 天', days: 30 },
  { label: '近 60 天', days: 60 },
  { label: '近 90 天', days: 90 },
] as const

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toDateStr(d)
}

export default function AiPage() {
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [activeReport, setActiveReport] = useState<ReportRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedType, setSelectedType] = useState<ReportType>('attribution')
  const [activePreset, setActivePreset] = useState<number | null>(30)
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate] = useState(toDateStr(new Date()))
  const [error, setError] = useState<string | null>(null)

  const handleTypeChange = (type: ReportType) => {
    setSelectedType(type)
    const opt = reportTypeOptions.find((o) => o.value === type)
    if (opt) {
      setActivePreset(opt.defaultDays)
      setStartDate(daysAgo(opt.defaultDays))
      setEndDate(toDateStr(new Date()))
    }
  }

  const selectPreset = (days: number) => {
    setActivePreset(days)
    setStartDate(daysAgo(days))
    setEndDate(toDateStr(new Date()))
  }

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/ai/reports')
      const json = await res.json()
      if (json.success) setReports(json.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleSelectReport = async (report: ReportRecord) => {
    try {
      const res = await fetch(`/api/ai/reports/${report.id}`)
      const json = await res.json()
      if (json.success) {
        setActiveReport(json.data)
        setError(null)
      }
    } catch {
      setError('無法載入報告')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: selectedType, period_start: startDate, period_end: endDate }),
      })
      const json = await res.json()
      if (json.success) {
        setActiveReport(json.data)
        fetchReports()
      } else {
        setError(json.error || '分析失敗')
      }
    } catch {
      setError('分析請求失敗')
    } finally {
      setGenerating(false)
    }
  }

  const renderReport = () => {
    if (!activeReport?.content) return null

    switch (activeReport.report_type) {
      case 'attribution': {
        const parsed = parseAttributionReport(activeReport.content)
        return parsed ? <AttributionReportView data={parsed} /> : <p className="text-sm text-red-500">報告格式無效</p>
      }
      case 'star_products': {
        const parsed = parseStarProductsReport(activeReport.content)
        return parsed ? <StarProductsReportView data={parsed} /> : <p className="text-sm text-red-500">報告格式無效</p>
      }
      case 'retire_candidates': {
        const parsed = parseRetireCandidatesReport(activeReport.content)
        return parsed ? <RetireCandidatesReportView data={parsed} /> : <p className="text-sm text-red-500">報告格式無效</p>
      }
      default:
        return <pre className="text-xs bg-slate-50 p-4 rounded overflow-auto">{JSON.stringify(activeReport.content, null, 2)}</pre>
    }
  }

  return (
    <div className="space-y-6">
      {/* Generate controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-50 rounded-full p-2">
            <Brain size={20} className="text-purple-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">AI 分析報告</h3>
        </div>

        <div className="flex flex-col gap-3">
          {/* Report type + generate button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value as ReportType)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {reportTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {generating && <Loader2 size={16} className="animate-spin" />}
              {generating ? '分析中...' : '產生分析報告'}
            </button>
          </div>

          {/* Period selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Calendar size={14} />
              <span>分析期間</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => selectPreset(p.days)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    activePreset === p.days
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset(null) }}
                className="px-2 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset(null) }}
                className="px-2 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 mt-3">{error}</p>
        )}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* History sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">歷史報告</h4>
            {loading ? (
              <div className="text-center text-slate-400 text-sm py-4">載入中...</div>
            ) : (
              <ReportHistory
                reports={reports}
                activeId={activeReport?.id || null}
                onSelect={handleSelectReport}
              />
            )}
          </div>
        </div>

        {/* Report viewer */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[300px]">
            {activeReport ? (
              renderReport()
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Brain size={32} className="mb-3 opacity-50" />
                <p className="text-sm">選擇歷史報告或產生新的分析</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
