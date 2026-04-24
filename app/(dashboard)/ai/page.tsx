'use client'

import { useEffect, useState } from 'react'
import { Brain, Loader2, Calendar, Share2, Check } from 'lucide-react'
import ReportHistory from '@/components/ai/ReportHistory'
import AttributionReportView from '@/components/ai/AttributionReport'
import StarProductsReportView from '@/components/ai/StarProductsReport'
import RetireCandidatesReportView from '@/components/ai/RetireCandidatesReport'
import LaborCostReportView from '@/components/ai/LaborCostReport'
import {
  ReportRecord,
  ReportType,
  parseAttributionReport,
  parseStarProductsReport,
  parseRetireCandidatesReport,
  parseLaborCostReport,
} from '@/lib/ai/reportRenderer'
import { useI18n } from '@/lib/i18n/context'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toDateStr(d)
}

export default function AiPage() {
  const { t } = useI18n()

  const [userRole, setUserRole] = useState<string>('manager')
  const isOwner = userRole === 'owner'

  const reportTypeOptions: { value: ReportType; label: string; defaultDays: number }[] = [
    { value: 'attribution', label: t('ai.revenueAttribution'), defaultDays: 30 },
    { value: 'star_products', label: t('ai.starProducts'), defaultDays: 60 },
    { value: 'retire_candidates', label: t('ai.discontinueCandidates'), defaultDays: 90 },
    // labor_cost is owner-only (reveals salary) — filtered below
    ...(isOwner ? [{ value: 'labor_cost' as ReportType, label: '人力成本分析', defaultDays: 90 }] : []),
  ]

  const RANGE_PRESETS = [
    { label: t('ai.last7'), days: 7 },
    { label: t('ai.last30'), days: 30 },
    { label: t('ai.last60'), days: 60 },
    { label: t('ai.last90'), days: 90 },
  ] as const

  const [reports, setReports] = useState<ReportRecord[]>([])
  const [activeReport, setActiveReport] = useState<ReportRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedType, setSelectedType] = useState<ReportType>('attribution')
  const [activePreset, setActivePreset] = useState<number | null>(30)
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate] = useState(toDateStr(new Date()))
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const fetchRole = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const json = await res.json()
      if (json.success) setUserRole(json.data?.role || 'manager')
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchReports()
    fetchRole()
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
      setError(t('ai.loadFailed'))
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
        setError(json.error || t('ai.analysisFailed'))
      }
    } catch {
      setError(t('ai.requestFailed'))
    } finally {
      setGenerating(false)
    }
  }

  const handleShare = async () => {
    if (!activeReport) return
    setSharing(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/reports/${activeReport.id}/share`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const url = `${window.location.origin}/shared/${json.data.share_token}`
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setError(json.error || t('ai.requestFailed'))
      }
    } catch {
      setError(t('ai.requestFailed'))
    } finally {
      setSharing(false)
    }
  }

  const renderReport = () => {
    if (!activeReport?.content) return null

    switch (activeReport.report_type) {
      case 'attribution': {
        const parsed = parseAttributionReport(activeReport.content)
        return parsed ? <AttributionReportView data={parsed} /> : <p className="text-sm text-red-500">{t('ai.invalidFormat')}</p>
      }
      case 'star_products': {
        const parsed = parseStarProductsReport(activeReport.content)
        return parsed ? <StarProductsReportView data={parsed} /> : <p className="text-sm text-red-500">{t('ai.invalidFormat')}</p>
      }
      case 'retire_candidates': {
        const parsed = parseRetireCandidatesReport(activeReport.content)
        return parsed ? <RetireCandidatesReportView data={parsed} /> : <p className="text-sm text-red-500">{t('ai.invalidFormat')}</p>
      }
      case 'labor_cost': {
        const parsed = parseLaborCostReport(activeReport.content)
        return parsed ? <LaborCostReportView data={parsed} /> : <p className="text-sm text-red-500">{t('ai.invalidFormat')}</p>
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
          <h3 className="text-base font-semibold text-slate-900">{t('ai.title')}</h3>
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
              {generating ? t('ai.analyzing') : t('ai.generateReport')}
            </button>
          </div>

          {/* Period selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Calendar size={14} />
              <span>{t('ai.analysisPeriod')}</span>
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
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('ai.historicalReports')}</h4>
            {loading ? (
              <div className="text-center text-slate-400 text-sm py-4">{t('common.loading')}</div>
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
              <>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-emerald-500" />
                        <span className="text-emerald-600">{t('ai.linkCopied')}</span>
                      </>
                    ) : sharing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Share2 size={14} />
                        <span>{t('ai.shareReport')}</span>
                      </>
                    )}
                  </button>
                </div>
                {renderReport()}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Brain size={32} className="mb-3 opacity-50" />
                <p className="text-sm">{t('ai.selectHistorical')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
