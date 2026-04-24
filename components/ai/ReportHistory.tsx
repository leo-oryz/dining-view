'use client'

import { format } from 'date-fns'
import { FileText } from 'lucide-react'
import { ReportRecord, ReportType } from '@/lib/ai/reportRenderer'

const typeLabels: Record<ReportType, string> = {
  attribution: '營收歸因',
  star_products: '明星商品',
  retire_candidates: '下架候選',
  labor_cost: '人力成本分析',
}

function formatPeriodLabel(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const s = new Date(start)
  const e = new Date(end)
  const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))

  const presetMap: Record<number, string> = { 7: '近7天', 30: '近30天', 60: '近60天', 90: '近90天' }
  const preset = presetMap[days] || `${days}天`

  const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `（${preset}）${fmtDate(s)}-${fmtDate(e)}`
}

interface Props {
  reports: ReportRecord[]
  activeId: string | null
  onSelect: (report: ReportRecord) => void
}

export default function ReportHistory({ reports, activeId, onSelect }: Props) {
  if (reports.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-6">
        尚無分析報告
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {reports.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r)}
          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
            activeId === r.id
              ? 'bg-purple-100 text-purple-900'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-slate-400 shrink-0" />
            <span className="font-medium truncate">
              {typeLabels[r.report_type] || r.report_type}
              {formatPeriodLabel(r.period_start, r.period_end)}
            </span>
          </div>
          <div className="text-xs text-slate-400 ml-5 mt-0.5">
            {format(new Date(r.created_at), 'yyyy/M/d HH:mm')}
          </div>
        </button>
      ))}
    </div>
  )
}
