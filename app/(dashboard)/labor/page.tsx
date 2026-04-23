'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Clock, DollarSign, TrendingUp, AlertTriangle, X, Calendar } from 'lucide-react'
import clsx from 'clsx'

// ─── Types ───
interface DailySummary {
  date: string
  staff_count: number
  total_scheduled_hours: number
  total_actual_hours: number
  total_overtime_hours: number
  total_labor_cost: number | null
  revenue: number
  labor_cost_ratio: number | null
  revenue_per_hour: number | null
  revenue_per_hour_ma7: number | null
}

interface HourlyEfficiency {
  date: string
  time_slot_start: string
  staff_count: number
  revenue: number
  revenue_per_staff: number | null
}

interface StaffRow {
  id: string
  employee_id: string
  name: string
  name_en: string | null
  employment_type: string
  hourly_rate: number | null
  monthly_salary: number | null
  month_hours: number
  overtime_hours: number
  month_cost: number | null
  revenue_per_hour: number | null
  hired_at: string | null
  left_at: string | null
  last_seen_date: string | null
  requires_review: boolean
  suspected_left: boolean
}

interface OvertimeData {
  topStaff: { staff_id: string; name: string; total_overtime: number; overtime_days: number }[]
  dateBreakdown: { date: string; overtime_hours: number }[]
}

interface PayrollCost {
  per_month: {
    year: number
    month: number
    total_payable: number | null
    total_revenue: number
    cost_ratio: number | null
    staff_count: number
    department_breakdown: { department: string; total: number }[]
  }[]
  aggregate: {
    total_payable: number
    total_revenue: number
    cost_ratio: number | null
    months_covered: string[]
  } | null
  months_missing: string[]
}

// ─── Helpers ───
const fmtNT = (v: number) => `NT$${Math.round(v).toLocaleString()}`
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const TARGET_RPH = 1600
const TARGET_COST_RATIO = 0.30

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 5) // 05:00~20:00

function getHeatColor(val: number, max: number): string {
  if (max === 0) return 'bg-gray-100'
  const ratio = val / max
  if (ratio >= 0.7) return 'bg-emerald-400'
  if (ratio >= 0.4) return 'bg-yellow-300'
  return 'bg-red-300'
}

export default function LaborPage() {
  const [summary, setSummary] = useState<DailySummary[]>([])
  const [hourly, setHourly] = useState<HourlyEfficiency[]>([])
  const [staffList, setStaffList] = useState<StaffRow[]>([])
  const [overtime, setOvertime] = useState<OvertimeData | null>(null)
  const [payrollCost, setPayrollCost] = useState<PayrollCost | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null)
  const [modalForm, setModalForm] = useState({ employment_type: 'full_time', hourly_rate: '', monthly_salary: '' })
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('manager')

  // Date range state — default last 30 days. All charts/tables respect this.
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const RANGE_PRESETS = [
    { label: '近 7 天', days: 7 },
    { label: '近 14 天', days: 14 },
    { label: '近 30 天', days: 30 },
    { label: '近 90 天', days: 90 },
  ] as const

  const applyPreset = (days: number) => {
    setStartDate(format(subDays(new Date(), days - 1), 'yyyy-MM-dd'))
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const applyThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = `from=${startDate}&to=${endDate}`
      const [sumRes, hourlyRes, staffRes, otRes, costRes, meRes] = await Promise.all([
        fetch(`/api/labor/summary?${qs}`),
        fetch(`/api/labor/hourly-efficiency?${qs}`),
        fetch(`/api/labor/staff?${qs}`),
        fetch(`/api/labor/overtime?${qs}`),
        fetch(`/api/labor/payroll-cost?${qs}`),
        fetch('/api/auth/me'),
      ])

      const [sumJson, hourlyJson, staffJson, otJson, costJson, meJson] = await Promise.all([
        sumRes.json(), hourlyRes.json(), staffRes.json(), otRes.json(), costRes.json(), meRes.json(),
      ])

      if (sumJson.success) setSummary(sumJson.data || [])
      if (hourlyJson.success) setHourly(hourlyJson.data || [])
      if (staffJson.success) setStaffList(staffJson.data || [])
      if (otJson.success) setOvertime(otJson.data || null)
      if (costJson.success) setPayrollCost(costJson.data || null)
      if (meJson.success) setUserRole(meJson.data?.role || 'manager')
    } catch { /* ignore */ }
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  // A day is "incomplete" when scheduled hours exist but actual_hours captured
  // is <30% of scheduled — usually because the nuEIP schedule was exported
  // mid-day (staff hadn't clocked out yet) or the day is still in the future.
  // These days have wildly misleading revenue_per_hour and must be excluded
  // from KPI aggregates and the trend line.
  const isIncomplete = (r: DailySummary) =>
    r.total_scheduled_hours > 0 &&
    r.total_actual_hours < r.total_scheduled_hours * 0.3

  const completeSummary = summary.filter(r => !isIncomplete(r))
  const incompleteCount = summary.length - completeSummary.length

  // ─── KPI calculations (over selected range, excluding incomplete days) ───
  const totalActualHours = completeSummary.reduce((s, r) => s + (r.total_actual_hours || 0), 0)
  const totalRevenue = completeSummary.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalOvertimeHours = completeSummary.reduce((s, r) => s + (r.total_overtime_hours || 0), 0)
  const hasAnyCost = completeSummary.some(r => r.total_labor_cost != null)

  // Cost ratio prefers payroll (ground truth) over the derived daily labor_cost.
  const payrollCostRatio = payrollCost?.aggregate?.cost_ratio ?? null
  const payrollMonths = payrollCost?.aggregate?.months_covered ?? []
  const missingMonths = payrollCost?.months_missing ?? []

  const avgRPH = totalActualHours > 0 ? totalRevenue / totalActualHours : 0
  const overtimeRate = totalActualHours > 0 ? totalOvertimeHours / totalActualHours : 0
  const overtimeCost = hasAnyCost
    ? completeSummary.reduce((s, r) => {
        // rough estimate: overtime portion of labor cost
        if (r.total_labor_cost && r.total_actual_hours && r.total_overtime_hours) {
          return s + (r.total_labor_cost * r.total_overtime_hours / r.total_actual_hours)
        }
        return s
      }, 0)
    : 0

  const isOwner = userRole === 'owner'

  // ─── Heatmap data ───
  const heatmapGrid: Record<string, { total: number; count: number }> = {}
  let heatmapMax = 0
  for (const row of hourly) {
    const dow = new Date(row.date).getDay()
    const hour = parseInt(row.time_slot_start.split(':')[0])
    const key = `${dow}-${hour}`
    if (!heatmapGrid[key]) heatmapGrid[key] = { total: 0, count: 0 }
    heatmapGrid[key].total += row.revenue_per_staff || 0
    heatmapGrid[key].count += 1
  }
  const heatmapCells: Record<string, number> = {}
  for (const [key, val] of Object.entries(heatmapGrid)) {
    const avg = val.count > 0 ? val.total / val.count : 0
    heatmapCells[key] = avg
    if (avg > heatmapMax) heatmapMax = avg
  }

  // ─── Dual axis data (average by time slot) ───
  const slotAgg: Record<string, { staffTotal: number; revTotal: number; count: number }> = {}
  for (const row of hourly) {
    const slot = row.time_slot_start
    if (!slotAgg[slot]) slotAgg[slot] = { staffTotal: 0, revTotal: 0, count: 0 }
    slotAgg[slot].staffTotal += row.staff_count
    slotAgg[slot].revTotal += row.revenue
    slotAgg[slot].count += 1
  }
  const dualAxisData = Object.entries(slotAgg)
    .map(([slot, agg]) => ({
      slot: slot.slice(0, 5),
      avgStaff: Math.round((agg.staffTotal / agg.count) * 10) / 10,
      avgRevenue: Math.round(agg.revTotal / agg.count),
    }))
    .sort((a, b) => a.slot.localeCompare(b.slot))

  // ─── Chart data ───
  // Null out incomplete days so recharts skips them (no misleading spikes/dips)
  const trendData = summary.map(s => {
    const incomplete = isIncomplete(s)
    return {
      date: format(new Date(s.date), 'M/d'),
      rph: incomplete ? null : s.revenue_per_hour,
      ma7: incomplete ? null : s.revenue_per_hour_ma7,
      revenue: incomplete ? null : s.revenue,
      hours: incomplete ? null : s.total_actual_hours,
    }
  })

  // ─── Modal handlers ───
  const openModal = (s: StaffRow) => {
    setSelectedStaff(s)
    setModalForm({
      employment_type: s.employment_type,
      hourly_rate: s.hourly_rate?.toString() || '',
      monthly_salary: s.monthly_salary?.toString() || '',
    })
  }

  const saveStaff = async () => {
    if (!selectedStaff) return
    setSaving(true)
    try {
      await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
          employment_type: modalForm.employment_type,
          hourly_rate: modalForm.hourly_rate ? parseFloat(modalForm.hourly_rate) : null,
          monthly_salary: modalForm.monthly_salary ? parseFloat(modalForm.monthly_salary) : null,
        }),
      })
      setSelectedStaff(null)
      fetchData()
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  if (summary.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Clock size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">尚無人力數據</h3>
        <p className="text-sm text-slate-500">
          請至<a href="/upload" className="text-blue-600 hover:underline">上傳頁面</a>上傳 NUEIP 班表
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">時間區間</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-sm">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {RANGE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={applyThisMonth}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              本月
            </button>
          </div>
        </div>
        {incompleteCount > 0 && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ⚠️ 已排除 {incompleteCount} 天資料不完整的日期（實際工時 &lt; 排班 30%，通常是班表剛匯出尚未打卡完畢或未來日期）
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue per hour */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-sm text-slate-500">工時產出</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{fmtNT(avgRPH)}<span className="text-sm font-normal text-slate-400">/人時</span></div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-slate-400">目標 {fmtNT(TARGET_RPH)}</span>
            <span className={clsx('text-xs font-medium', avgRPH >= TARGET_RPH ? 'text-emerald-600' : 'text-red-500')}>
              {avgRPH >= TARGET_RPH ? '🟢 達標' : '🔴 未達標'}
            </span>
          </div>
        </div>

        {/* Labor cost ratio (from payroll — ground truth) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-amber-500" />
            <span className="text-sm text-slate-500">人力成本率</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {payrollCostRatio != null ? fmtPct(payrollCostRatio) : '—'}
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">目標 {fmtPct(TARGET_COST_RATIO)}</span>
            {payrollCostRatio != null && (
              <span className={clsx('text-xs font-medium', payrollCostRatio <= TARGET_COST_RATIO ? 'text-emerald-600' : 'text-red-500')}>
                {payrollCostRatio <= TARGET_COST_RATIO ? '🟢 達標' : '🔴 未達標'}
              </span>
            )}
          </div>
          {payrollMonths.length > 0 && (
            <div className="text-[10px] text-slate-400 mt-1">
              計算範圍：{payrollMonths.join(', ')}
              {missingMonths.length > 0 && <span className="text-amber-600"> · {missingMonths.join(', ')} 薪資未上傳</span>}
            </div>
          )}
        </div>

        {/* Total hours */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-indigo-500" />
            <span className="text-sm text-slate-500">期間總工時</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{Math.round(totalActualHours)} <span className="text-sm font-normal text-slate-400">小時</span></div>
          <div className="text-xs text-slate-400 mt-1">
            加班率 {fmtPct(overtimeRate)}
          </div>
        </div>

        {/* Overtime hours */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-orange-500" />
            <span className="text-sm text-slate-500">期間加班工時</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{Math.round(totalOvertimeHours * 10) / 10} <span className="text-sm font-normal text-slate-400">小時</span></div>
          {hasAnyCost && overtimeCost > 0 && (
            <div className="text-xs text-slate-400 mt-1">
              加班成本 {fmtNT(overtimeCost)}
            </div>
          )}
        </div>
      </div>

      {/* Payroll breakdown by month + department */}
      {payrollCost && payrollCost.per_month.some(m => m.total_payable != null) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-1">月人力成本（實際薪資）</h3>
          <p className="text-xs text-slate-400 mb-4">來源：人事薪資表；部門拆解顯示該月實付總額</p>
          <div className="space-y-4">
            {payrollCost.per_month.filter(m => m.total_payable != null).map(m => {
              const label = `${m.year}-${String(m.month).padStart(2, '0')}`
              const ratio = m.cost_ratio
              return (
                <div key={label} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-slate-900">{label}</div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">營收 {fmtNT(m.total_revenue)}</span>
                      <span className="text-slate-500">薪資 {fmtNT(m.total_payable || 0)}</span>
                      <span className={clsx('font-semibold', ratio == null ? 'text-slate-400' : ratio <= TARGET_COST_RATIO ? 'text-emerald-600' : 'text-red-500')}>
                        {ratio != null ? fmtPct(ratio) : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {m.department_breakdown.map(d => (
                      <span key={d.department} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md">
                        <span className="text-slate-600">{d.department}</span>
                        <span className="text-slate-900 font-medium">{fmtNT(d.total)}</span>
                        <span className="text-slate-400">({((d.total / (m.total_payable || 1)) * 100).toFixed(0)}%)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {payrollCost.months_missing.length > 0 && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              ⚠️ {payrollCost.months_missing.join(', ')} 薪資尚未上傳，這幾個月不計入成本率
            </div>
          )}
        </div>
      )}

      {/* Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">工時產出趨勢</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val, name) => {
                  const v = Number(val)
                  if (name === '工時產出') return [fmtNT(v), name]
                  if (name === '7日均值') return [fmtNT(v), name]
                  return [v, name]
                }}
                labelFormatter={(label) => label}
              />
              <Legend />
              <ReferenceLine y={TARGET_RPH} stroke="#9ca3af" strokeDasharray="6 4" label={{ value: `目標 ${fmtNT(TARGET_RPH)}`, position: 'right', fontSize: 11, fill: '#9ca3af' }} />
              <Line type="monotone" dataKey="rph" name="工時產出" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ma7" name="7日均值" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-1">時段人力效益熱力圖</h3>
        <p className="text-xs text-slate-400 mb-4">顏色越紅代表人均營收越低，可考慮減少排班人數</p>
        {hourly.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">尚無時段資料</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-slate-500 text-left w-8"></th>
                  {HOURS.map(h => (
                    <th key={h} className="p-1 text-slate-500 font-normal text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((label, dow) => (
                  <tr key={dow}>
                    <td className="p-1 text-slate-600 font-medium">{label}</td>
                    {HOURS.map(h => {
                      const val = heatmapCells[`${dow}-${h}`] ?? 0
                      return (
                        <td key={h} className="p-1">
                          <div
                            className={clsx('w-full aspect-square rounded-sm min-w-[20px]', getHeatColor(val, heatmapMax))}
                            title={`週${label} ${h}:00 — 每人 ${fmtNT(val)}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dual Axis Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-1">時段在班人數 vs 營收</h3>
        <p className="text-xs text-slate-400 mb-4">兩線同步 = 人力配置合理</p>
        {dualAxisData.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">尚無時段資料</div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dualAxisData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="slot" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: '人數', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: '營收', angle: 90, position: 'insideRight', fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name) => {
                    const v = Number(val)
                    if (name === '平均營收') return [fmtNT(v), name]
                    return [v, name]
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="avgStaff" name="在班人數" fill="#f97316" opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="avgRevenue" name="平均營收" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">員工工時產出</h3>
          <div className="flex gap-2 text-xs">
            {(() => {
              const reviewCount = staffList.filter(s => s.requires_review).length
              const leftCount = staffList.filter(s => s.suspected_left).length
              return (
                <>
                  {reviewCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                      📝 {reviewCount} 待審核
                    </span>
                  )}
                  {leftCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded">
                      👻 {leftCount} 疑似離職
                    </span>
                  )}
                </>
              )
            })()}
          </div>
        </div>
        {staffList.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">尚無員工資料</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">姓名</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">狀態</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">期間工時</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">加班工時</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">薪資成本</th>
                  <th className="text-right py-2 px-2 text-slate-500 font-medium">工時產出</th>
                </tr>
              </thead>
              <tbody>
                {[...staffList]
                  .sort((a, b) => (b.revenue_per_hour || 0) - (a.revenue_per_hour || 0))
                  .map(s => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => isOwner && openModal(s)}
                    >
                      <td className="py-2 px-2 text-slate-900">{s.name}</td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {s.requires_review && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">待審核</span>
                          )}
                          {s.suspected_left && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">疑似離職</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-slate-700">{s.month_hours.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right text-slate-700">
                        {s.overtime_hours > 0 ? s.overtime_hours.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-700">
                        {isOwner ? (s.month_cost != null ? fmtNT(s.month_cost) : '—') : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-900">
                        {s.revenue_per_hour != null ? fmtNT(s.revenue_per_hour) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Overtime Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top overtime staff */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">加班最多員工</h3>
          {overtime?.topStaff && overtime.topStaff.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overtime.topStaff.slice(0, 5)}
                  layout="vertical"
                  margin={{ left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={55} />
                  <Tooltip formatter={(val) => [`${Number(val).toFixed(1)} 小時`, '加班工時']} />
                  <Bar dataKey="total_overtime" name="加班工時" radius={[0, 4, 4, 0]}>
                    {overtime.topStaff.slice(0, 5).map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? '#ef4444' : idx < 3 ? '#f97316' : '#fbbf24'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-sm py-8">本月無加班紀錄</div>
          )}
        </div>

        {/* Overtime by date */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">加班集中日期</h3>
          {overtime?.dateBreakdown && overtime.dateBreakdown.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overtime.dateBreakdown.slice(0, 7).sort((a, b) => a.date.localeCompare(b.date))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={d => format(new Date(d), 'M/d')} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(val) => [`${Number(val).toFixed(1)} 小時`, '加班工時']}
                    labelFormatter={d => format(new Date(d), 'M/d (E)')}
                  />
                  <Bar dataKey="overtime_hours" name="加班工時" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-sm py-8">本月無加班紀錄</div>
          )}
        </div>
      </div>

      {/* Staff Salary Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedStaff(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">員工薪資設定</h3>
              <button onClick={() => setSelectedStaff(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">員工編號</label>
                <div className="text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{selectedStaff.employee_id}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">姓名</label>
                <div className="text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                  {selectedStaff.name}{selectedStaff.name_en ? ` (${selectedStaff.name_en})` : ''}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">雇用類型</label>
                <select
                  value={modalForm.employment_type}
                  onChange={e => setModalForm(f => ({ ...f, employment_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="full_time">全職</option>
                  <option value="part_time">兼職</option>
                </select>
              </div>
              {modalForm.employment_type === 'full_time' ? (
                <div>
                  <label className="block text-sm text-slate-500 mb-1">月薪</label>
                  <input
                    type="number"
                    value={modalForm.monthly_salary}
                    onChange={e => setModalForm(f => ({ ...f, monthly_salary: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="例：35000"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-slate-500 mb-1">時薪</label>
                  <input
                    type="number"
                    value={modalForm.hourly_rate}
                    onChange={e => setModalForm(f => ({ ...f, hourly_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="例：183"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-500 mb-1">加班時薪（計算加班費用）</label>
                <input
                  type="number"
                  value={modalForm.hourly_rate}
                  onChange={e => setModalForm(f => ({ ...f, hourly_rate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="例：183"
                />
              </div>

              <button
                onClick={saveStaff}
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
