'use client'

import clsx from 'clsx'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx('animate-pulse rounded bg-slate-200', className)}
    />
  )
}

export function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  )
}
