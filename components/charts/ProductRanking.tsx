'use client'

interface ProductData {
  product_name: string
  category: string | null
  quantity_sold: number | null
  revenue: number | null
  gross_margin: number | null
}

interface ProductRankingProps {
  data: ProductData[]
}

export function ProductRanking({ data }: ProductRankingProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        尚無商品資料
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-2 text-slate-500 font-medium">#</th>
            <th className="text-left py-3 px-2 text-slate-500 font-medium">商品名稱</th>
            <th className="text-left py-3 px-2 text-slate-500 font-medium hidden sm:table-cell">分類</th>
            <th className="text-right py-3 px-2 text-slate-500 font-medium">銷量</th>
            <th className="text-right py-3 px-2 text-slate-500 font-medium">營收</th>
            <th className="text-right py-3 px-2 text-slate-500 font-medium hidden md:table-cell">毛利率</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2.5 px-2 text-slate-400">{idx + 1}</td>
              <td className="py-2.5 px-2 font-medium text-slate-900">{item.product_name}</td>
              <td className="py-2.5 px-2 text-slate-500 hidden sm:table-cell">{item.category || '-'}</td>
              <td className="py-2.5 px-2 text-right text-slate-700">{item.quantity_sold?.toLocaleString() ?? '-'}</td>
              <td className="py-2.5 px-2 text-right text-slate-700">
                {item.revenue != null ? `₫${item.revenue.toLocaleString()}` : '-'}
              </td>
              <td className="py-2.5 px-2 text-right hidden md:table-cell">
                {item.gross_margin != null ? `${(item.gross_margin * 100).toFixed(0)}%` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
