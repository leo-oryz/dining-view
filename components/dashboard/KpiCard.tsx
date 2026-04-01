'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: number | null
  changeLabel?: string
  icon?: React.ReactNode
}

export function KpiCard({ title, value, subtitle, change, changeLabel, icon }: KpiCardProps) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      {change !== undefined && change !== null && (
        <div className="mt-3 flex items-center gap-1">
          {isPositive ? (
            <TrendingUp size={14} className="text-emerald-500" />
          ) : isNegative ? (
            <TrendingDown size={14} className="text-red-500" />
          ) : null}
          <span
            className={clsx(
              'text-sm font-medium',
              isPositive && 'text-emerald-600',
              isNegative && 'text-red-600',
              !isPositive && !isNegative && 'text-slate-500'
            )}
          >
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-xs text-slate-400 ml-1">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
