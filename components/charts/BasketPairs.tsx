'use client'

interface PairData {
  product_a: string
  product_b: string
  co_occurrence: number
  support_pct: number
}

interface BasketPairsProps {
  data: PairData[]
  totalOrders: number
}

export function BasketPairs({ data, totalOrders }: BasketPairsProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無組合分析資料
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-slate-400 mb-3">
        分析期間共 {totalOrders.toLocaleString()} 筆訂單
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-2 text-slate-500 font-medium">#</th>
              <th className="text-left py-3 px-2 text-slate-500 font-medium">商品 A</th>
              <th className="text-left py-3 px-2 text-slate-500 font-medium">商品 B</th>
              <th className="text-right py-3 px-2 text-slate-500 font-medium">共同出現</th>
              <th className="text-right py-3 px-2 text-slate-500 font-medium hidden sm:table-cell">訂單佔比</th>
            </tr>
          </thead>
          <tbody>
            {data.map((pair, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 px-2 text-slate-400">{idx + 1}</td>
                <td className="py-2.5 px-2 font-medium text-slate-900">{pair.product_a}</td>
                <td className="py-2.5 px-2 font-medium text-slate-900">{pair.product_b}</td>
                <td className="py-2.5 px-2 text-right text-slate-700">{pair.co_occurrence.toLocaleString()}</td>
                <td className="py-2.5 px-2 text-right text-slate-700 hidden sm:table-cell">
                  {(pair.support_pct * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
