'use client'

import clsx from 'clsx'

interface StoreKpis {
  revenue_total: number
  guest_count: number
  avg_spend_per_guest: number
  table_turnover_rate: number
  member_new: number
  returning_customer_ratio: number
}

interface StoreComparison {
  store_id: string
  store_name: string
  current: StoreKpis | null
  deltas: Record<string, number | null> | null
}

interface Props {
  stores: StoreComparison[]
}

const metrics: { key: keyof StoreKpis; label: string; format: (v: number) => string }[] = [
  { key: 'revenue_total', label: '營業額', format: v => `NT$${Math.round(v).toLocaleString()}` },
  { key: 'guest_count', label: '來客數', format: v => Math.round(v).toLocaleString() },
  { key: 'avg_spend_per_guest', label: '客單價', format: v => `NT$${v.toFixed(0)}` },
  { key: 'table_turnover_rate', label: '翻桌率', format: v => v.toFixed(2) },
  { key: 'member_new', label: '新會員', format: v => Math.round(v).toLocaleString() },
  { key: 'returning_customer_ratio', label: '回頭客比例', format: v => `${(v * 100).toFixed(1)}%` },
]

function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-xs text-slate-300">—</span>
  const positive = value > 0
  const negative = value < 0
  return (
    <span className={clsx(
      'text-xs font-medium',
      positive && 'text-emerald-600',
      negative && 'text-red-600',
      !positive && !negative && 'text-slate-400',
    )}>
      {positive ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

export default function StoreCompareTable({ stores }: Props) {
  if (stores.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">無門店資料</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-slate-500 font-medium">指標</th>
            {stores.map(s => (
              <th key={s.store_id} className="text-right py-3 px-4 text-slate-900 font-semibold" colSpan={2}>
                {s.store_name}
              </th>
            ))}
          </tr>
          <tr className="border-b border-slate-100">
            <th></th>
            {stores.map(s => (
              <th key={s.store_id} colSpan={2} className="text-right py-1 px-4">
                <span className="text-xs text-slate-400">數值 / vs 上期</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => (
            <tr key={m.key} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-3 px-4 font-medium text-slate-700">{m.label}</td>
              {stores.map(s => (
                <td key={s.store_id} colSpan={2} className="py-3 px-4 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-slate-900">
                      {s.current ? m.format(s.current[m.key]) : '—'}
                    </span>
                    <DeltaBadge value={s.deltas?.[m.key]} />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
