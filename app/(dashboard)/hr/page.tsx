'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, UserCheck, UserX, CalendarDays, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useI18n } from '@/lib/i18n/context'

interface HRSummary {
  configured: boolean
  headcount: {
    total_active: number
    by_department: Record<string, number>
    by_employment_type: Record<string, number>
  }
  attendance: {
    total: number
    late_count: number
    absent_count: number
    late_rate: number
    absence_rate: number
    daily: { date: string; scheduled: number; present: number }[]
  }
  leave: {
    upcoming: {
      id: string
      employee_name: string
      leave_type: string
      start_date: string
      end_date: string
    }[]
    breakdown: Record<string, number>
  }
  payroll: {
    current: { period_start: string; period_end: string; total_cost: number; headcount: number | null } | null
    previous: { period_start: string; period_end: string; total_cost: number } | null
    labor_cost_pct: number | null
    mom_change_pct: number | null
  }
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function fmtVND(n: number): string {
  return `₫${Math.round(n).toLocaleString('en-US')}`
}

export default function HRDashboardPage() {
  const { t } = useI18n()
  const [data, setData] = useState<HRSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/hr/summary')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="text-sm text-slate-400">{t('common.loading')}</div>
    )
  }

  if (!data || !data.configured) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <Users size={32} className="mx-auto text-slate-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-900 mb-1">{t('hr.notConnected')}</h3>
        <p className="text-sm text-slate-500 mb-4">{t('hr.connectHint')}</p>
        <Link
          href="/settings"
          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          {t('hr.goToSettings')}
        </Link>
      </div>
    )
  }

  const departmentData = Object.entries(data.headcount.by_department).map(([k, v]) => ({
    name: k,
    value: v,
  }))
  const employmentData = Object.entries(data.headcount.by_employment_type).map(([k, v]) => ({
    name: k,
    value: v,
  }))
  const leaveData = Object.entries(data.leave.breakdown).map(([k, v]) => ({
    name: k,
    value: v,
  }))

  return (
    <div className="space-y-6">
      {/* Headcount summary */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('hr.headcount')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{t('hr.activeStaff')}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.headcount.total_active}</p>
              </div>
              <Users size={20} className="text-slate-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 font-medium mb-2">{t('hr.byDepartment')}</p>
            <ul className="space-y-1">
              {departmentData.length === 0 ? (
                <li className="text-xs text-slate-400">—</li>
              ) : (
                departmentData.map((d) => (
                  <li key={d.name} className="flex justify-between text-sm">
                    <span className="text-slate-600 capitalize">{d.name}</span>
                    <span className="font-medium text-slate-900">{d.value}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 font-medium mb-2">{t('hr.byEmploymentType')}</p>
            <ul className="space-y-1">
              {employmentData.length === 0 ? (
                <li className="text-xs text-slate-400">—</li>
              ) : (
                employmentData.map((d) => (
                  <li key={d.name} className="flex justify-between text-sm">
                    <span className="text-slate-600 capitalize">{d.name.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-900">{d.value}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Attendance */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('hr.attendance7d')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{t('hr.lateRate')}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {data.attendance.late_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.attendance.late_count} / {data.attendance.total}
                </p>
              </div>
              <UserCheck size={20} className="text-slate-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{t('hr.absenceRate')}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {data.attendance.absence_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.attendance.absent_count} / {data.attendance.total}
                </p>
              </div>
              <UserX size={20} className="text-slate-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-1">
            <p className="text-sm text-slate-500 font-medium mb-2">{t('hr.totalShifts')}</p>
            <p className="text-2xl font-bold text-slate-900">{data.attendance.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4">
          <h3 className="text-base font-semibold text-slate-900 mb-4">{t('hr.dailyAttendance')}</h3>
          {data.attendance.daily.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t('hr.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.attendance.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Bar dataKey="scheduled" fill="#94a3b8" name={t('hr.scheduled')} />
                <Bar dataKey="present" fill="#3b82f6" name={t('hr.present')} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Leave */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('hr.leaveOverview')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" />
              {t('hr.upcomingLeave')}
            </h3>
            {data.leave.upcoming.length === 0 ? (
              <p className="text-sm text-slate-400">{t('hr.noUpcomingLeave')}</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {data.leave.upcoming.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                    <div>
                      <p className="font-medium text-slate-900">{l.employee_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{l.leave_type}</p>
                    </div>
                    <span className="text-xs text-slate-600">
                      {l.start_date}
                      {l.start_date !== l.end_date ? ` → ${l.end_date}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('hr.leaveBreakdown')}</h3>
            {leaveData.length === 0 ? (
              <p className="text-sm text-slate-400">{t('hr.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={leaveData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40} label>
                    {leaveData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Payroll */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('hr.payrollCost')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{t('hr.currentMonthCost')}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {data.payroll.current ? fmtVND(data.payroll.current.total_cost) : '—'}
                </p>
              </div>
              <DollarSign size={20} className="text-slate-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{t('hr.laborCostPct')}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {data.payroll.labor_cost_pct != null
                    ? `${data.payroll.labor_cost_pct.toFixed(1)}%`
                    : '—'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{t('hr.ofRevenue')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 font-medium">{t('hr.momChange')}</p>
            {data.payroll.mom_change_pct != null ? (
              <div className="mt-1 flex items-center gap-2">
                {data.payroll.mom_change_pct >= 0 ? (
                  <TrendingUp size={20} className="text-red-500" />
                ) : (
                  <TrendingDown size={20} className="text-emerald-500" />
                )}
                <span
                  className={`text-2xl font-bold ${
                    data.payroll.mom_change_pct >= 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {data.payroll.mom_change_pct >= 0 ? '+' : ''}
                  {data.payroll.mom_change_pct.toFixed(1)}%
                </span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-slate-900 mt-1">—</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {data.payroll.previous ? fmtVND(data.payroll.previous.total_cost) : '—'} {t('hr.previousMonth')}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
