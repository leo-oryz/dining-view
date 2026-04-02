'use client'

import { AlertTriangle } from 'lucide-react'

interface Props {
  dormantPct: number
}

export default function DormantAlert({ dormantPct }: Props) {
  if (dormantPct <= 30) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-800">
          沉睡會員比例偏高：{dormantPct.toFixed(1)}%
        </p>
        <p className="text-xs text-red-600 mt-1">
          超過 30% 的會員已進入沉睡狀態。建議透過推播活動或優惠券喚回這些會員。
        </p>
      </div>
    </div>
  )
}
