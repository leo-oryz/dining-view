import { SupabaseClient } from '@supabase/supabase-js'

export interface SkuMargin {
  product_name: string
  category: string | null
  total_quantity: number
  total_revenue: number
  total_cost: number
  gross_margin: number
  avg_margin: number
  qty_trend_pct: number
}

/**
 * Compute gross margin per SKU from product_sales over a given period,
 * plus qty_trend_pct comparing current period vs the preceding period
 * of equal length.
 */
export async function getMarginMatrix(
  supabase: SupabaseClient,
  storeId: string,
  periodStart: string,
  periodEnd: string
): Promise<SkuMargin[]> {
  // Calculate preceding period of equal length
  const startMs = new Date(periodStart).getTime()
  const endMs = new Date(periodEnd).getTime()
  const durationMs = endMs - startMs
  const prevStart = new Date(startMs - durationMs).toISOString().slice(0, 10)
  const prevEnd = new Date(startMs - 86400000).toISOString().slice(0, 10) // day before current start

  // Fetch both periods in parallel
  const [currentRes, prevRes] = await Promise.all([
    supabase
      .from('product_sales')
      .select('product_name, category, quantity_sold, revenue, gross_profit, gross_margin')
      .eq('store_id', storeId)
      .gte('date', periodStart)
      .lte('date', periodEnd),
    supabase
      .from('product_sales')
      .select('product_name, quantity_sold')
      .eq('store_id', storeId)
      .gte('date', prevStart)
      .lte('date', prevEnd),
  ])

  if (currentRes.error || !currentRes.data || currentRes.data.length === 0) return []

  // Aggregate previous period quantities by product
  const prevQtyMap = new Map<string, number>()
  if (prevRes.data) {
    for (const row of prevRes.data) {
      const existing = prevQtyMap.get(row.product_name) || 0
      prevQtyMap.set(row.product_name, existing + (row.quantity_sold || 0))
    }
  }

  // Aggregate current period by product_name
  const map = new Map<string, {
    category: string | null
    totalQty: number
    totalRevenue: number
    totalProfit: number
    marginSum: number
    count: number
  }>()

  for (const row of currentRes.data) {
    const existing = map.get(row.product_name)
    if (existing) {
      existing.totalQty += row.quantity_sold || 0
      existing.totalRevenue += row.revenue || 0
      existing.totalProfit += row.gross_profit || 0
      existing.marginSum += row.gross_margin || 0
      existing.count++
    } else {
      map.set(row.product_name, {
        category: row.category,
        totalQty: row.quantity_sold || 0,
        totalRevenue: row.revenue || 0,
        totalProfit: row.gross_profit || 0,
        marginSum: row.gross_margin || 0,
        count: 1,
      })
    }
  }

  return Array.from(map.entries())
    .map(([name, agg]) => {
      const prevQty = prevQtyMap.get(name) || 0
      const trendPct = prevQty > 0
        ? ((agg.totalQty - prevQty) / prevQty) * 100
        : agg.totalQty > 0 ? 100 : 0 // new product = +100%, no data = 0

      return {
        product_name: name,
        category: agg.category,
        total_quantity: agg.totalQty,
        total_revenue: agg.totalRevenue,
        total_cost: agg.totalRevenue - agg.totalProfit,
        gross_margin: agg.totalRevenue > 0
          ? agg.totalProfit / agg.totalRevenue
          : 0,
        avg_margin: agg.count > 0 ? agg.marginSum / agg.count : 0,
        qty_trend_pct: Math.round(trendPct * 10) / 10,
      }
    })
    .sort((a, b) => b.total_revenue - a.total_revenue)
}
