'use client'

interface HourlyRecord {
  date: string
  hour: number
  net_sales: number | null
}

interface WeekdayHeatmapProps {
  data: HourlyRecord[]
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 9) // 09:00 ~ 23:00

export function WeekdayHeatmap({ data }: WeekdayHeatmapProps) {
  // Aggregate: weekday × hour → average net_sales
  const grid: Record<string, { total: number; count: number }> = {}

  for (const row of data) {
    const dow = new Date(row.date).getDay()
    const key = `${dow}-${row.hour}`
    if (!grid[key]) grid[key] = { total: 0, count: 0 }
    grid[key].total += row.net_sales ?? 0
    grid[key].count += 1
  }

  let maxAvg = 0
  const cells: Record<string, number> = {}
  for (const [key, val] of Object.entries(grid)) {
    const avg = val.count > 0 ? val.total / val.count : 0
    cells[key] = avg
    if (avg > maxAvg) maxAvg = avg
  }

  const getOpacity = (val: number) => {
    if (maxAvg === 0) return 0.05
    return Math.max(0.05, val / maxAvg)
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無時段資料
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-1 text-slate-500 text-left w-8"></th>
            {HOURS.map((h) => (
              <th key={h} className="p-1 text-slate-500 font-normal text-center">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_LABELS.map((label, dow) => (
            <tr key={dow}>
              <td className="p-1 text-slate-600 font-medium">{label}</td>
              {HOURS.map((h) => {
                const val = cells[`${dow}-${h}`] ?? 0
                return (
                  <td key={h} className="p-1">
                    <div
                      className="w-full aspect-square rounded-sm min-w-[20px]"
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${getOpacity(val)})`,
                      }}
                      title={`週${label} ${h}:00 — 平均 ₫${Math.round(val).toLocaleString()}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
