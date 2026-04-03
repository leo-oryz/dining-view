'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Brain, Loader2 } from 'lucide-react'
import { KpiSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { ExpansionReport } from '@/components/ai/ExpansionReport'

const TimeSlotHeatmap = dynamic(
  () => import('@/components/expansion/TimeSlotHeatmap').then((m) => ({ default: m.TimeSlotHeatmap })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const CategoryBreakdown = dynamic(
  () => import('@/components/expansion/CategoryBreakdown').then((m) => ({ default: m.CategoryBreakdown })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const DemographicProfile = dynamic(
  () => import('@/components/expansion/DemographicProfile').then((m) => ({ default: m.DemographicProfile })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const SeasonalHeatmap = dynamic(
  () => import('@/components/expansion/SeasonalHeatmap').then((m) => ({ default: m.SeasonalHeatmap })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

interface TimeSlotData { hour: number; avg_sales: number; avg_guests: number }
interface CategoryData { category: string; total_revenue: number; total_qty: number }
interface DemographicData {
  gender: { male: number; female: number; unknown: number }
  age: { label: string; count: number }[]
}
interface MonthlyData { month: string; total_revenue: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpansionReportData = any

export default function ExpansionPage() {
  const [loading, setLoading] = useState(true)
  const [timeSlots, setTimeSlots] = useState<TimeSlotData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [demographics, setDemographics] = useState<DemographicData | null>(null)
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [revenuePerSeat, setRevenuePerSeat] = useState<number | null>(null)
  const [aiReport, setAiReport] = useState<ExpansionReportData>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    loadExpansionData()
  }, [])

  async function loadExpansionData() {
    try {
      // Fetch hourly averages
      const hourlyRes = await fetch('/api/sales/hourly?aggregate=avg')
      const hourlyJson = await hourlyRes.json()
      if (hourlyJson.success && hourlyJson.data) {
        // Aggregate hourly data into averages by hour
        const hourMap = new Map<number, { totalSales: number; totalGuests: number; count: number }>()
        for (const row of hourlyJson.data) {
          const existing = hourMap.get(row.hour) || { totalSales: 0, totalGuests: 0, count: 0 }
          existing.totalSales += Number(row.net_sales) || 0
          existing.totalGuests += Number(row.guest_count) || 0
          existing.count++
          hourMap.set(row.hour, existing)
        }
        const slots: TimeSlotData[] = []
        for (const [hour, agg] of Array.from(hourMap.entries())) {
          slots.push({
            hour,
            avg_sales: Math.round(agg.totalSales / agg.count),
            avg_guests: Math.round(agg.totalGuests / agg.count),
          })
        }
        setTimeSlots(slots)
      }

      // Fetch product categories
      const end = new Date().toISOString().slice(0, 10)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 90)
      const start = startDate.toISOString().slice(0, 10)

      const prodRes = await fetch(`/api/sales/products?start_date=${start}&end_date=${end}`)
      const prodJson = await prodRes.json()
      if (prodJson.success && prodJson.data) {
        const catMap = new Map<string, { revenue: number; qty: number }>()
        for (const p of prodJson.data) {
          const cat = p.category || '未分類'
          const existing = catMap.get(cat) || { revenue: 0, qty: 0 }
          existing.revenue += Number(p.revenue) || 0
          existing.qty += Number(p.quantity_sold) || 0
          catMap.set(cat, existing)
        }
        const cats: CategoryData[] = Array.from(catMap.entries())
          .map(([category, v]) => ({ category, total_revenue: v.revenue, total_qty: v.qty }))
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 10)
        setCategories(cats)
      }

      // Fetch member demographics from latest snapshot
      const memberRes = await fetch('/api/members/demographics')
      const memberJson = await memberRes.json()
      if (memberJson.success && memberJson.data) {
        setDemographics(memberJson.data)
      }

      // Fetch daily sales for monthly aggregation + per-seat calc
      const dailyRes = await fetch(`/api/sales/daily?start_date=${start}&end_date=${end}`)
      const dailyJson = await dailyRes.json()
      if (dailyJson.success && dailyJson.data) {
        // Monthly aggregation
        const monthMap = new Map<string, number>()
        let totalRevenue = 0
        let dayCount = 0
        for (const d of dailyJson.data) {
          const month = d.date.slice(0, 7)
          monthMap.set(month, (monthMap.get(month) || 0) + (Number(d.net_sales) || 0))
          totalRevenue += Number(d.net_sales) || 0
          dayCount++
        }
        const monthlyData: MonthlyData[] = Array.from(monthMap.entries())
          .map(([month, total_revenue]) => ({ month, total_revenue }))
          .sort((a, b) => a.month.localeCompare(b.month))
        setMonthly(monthlyData)

        // Revenue per seat (assume ~40 seats as baseline)
        if (dayCount > 0) {
          const dailyAvg = totalRevenue / dayCount
          setRevenuePerSeat(Math.round(dailyAvg / 40))
        }
      }

      // Check for existing expansion report
      const reportRes = await fetch('/api/ai/reports?report_type=expansion')
      const reportJson = await reportRes.json()
      if (reportJson.success && reportJson.data?.length > 0) {
        setAiReport(reportJson.data[0].content)
      }
    } catch {
      // Non-critical — charts just stay empty
    } finally {
      setLoading(false)
    }
  }

  async function generateReport() {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/expansion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.success) {
        setAiReport(json.data.content)
      } else {
        setAiError(json.error || 'Analysis failed')
      }
    } catch {
      setAiError('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">展店決策分析</h1>
        <p className="text-sm text-slate-500 mt-1">基於現有門店數據，分析新店選址與型態建議</p>
      </div>

      {/* Revenue per seat KPI */}
      {revenuePerSeat !== null && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">每席位日均營收基準</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            NT${revenuePerSeat.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">以 40 席計算</div>
        </div>
      )}

      {/* Time slot performance */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">最佳營業時段</h3>
        <TimeSlotHeatmap data={timeSlots} />
      </div>

      {/* Top revenue categories */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">營收主力品類</h3>
        <CategoryBreakdown data={categories} />
      </div>

      {/* Member demographics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">會員人口統計</h3>
        <DemographicProfile data={demographics} />
      </div>

      {/* Seasonal pattern */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">月度營收趨勢</h3>
        <SeasonalHeatmap data={monthly} />
      </div>

      {/* AI Expansion Report */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">AI 展店準備度報告</h3>
          <button
            onClick={generateReport}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {aiLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Brain size={16} />
                {aiReport ? '重新分析' : '產生報告'}
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {aiError}
          </div>
        )}

        {aiReport ? (
          <ExpansionReport data={aiReport} />
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            點擊「產生報告」讓 AI 分析展店準備度
          </div>
        )}
      </div>
    </div>
  )
}
