import { SupabaseClient } from '@supabase/supabase-js'

export interface SkuMargin {
  product_name: string
  category: string | null
  total_quantity: number
  total_revenue: number
  total_cost: number
  gross_margin: number
  avg_margin: number
}

/**
 * Compute gross margin per SKU from product_sales over a given period.
 */
export async function getMarginMatrix(
  supabase: SupabaseClient,
  storeId: string,
  periodStart: string,
  periodEnd: string
): Promise<SkuMargin[]> {
  const { data, error } = await supabase
    .from('product_sales')
    .select('product_name, category, quantity_sold, revenue, gross_profit, gross_margin')
    .eq('store_id', storeId)
    .gte('date', periodStart)
    .lte('date', periodEnd)

  if (error || !data || data.length === 0) return []

  // Aggregate by product_name
  const map = new Map<string, {
    category: string | null
    totalQty: number
    totalRevenue: number
    totalProfit: number
    marginSum: number
    count: number
  }>()

  for (const row of data) {
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
    .map(([name, agg]) => ({
      product_name: name,
      category: agg.category,
      total_quantity: agg.totalQty,
      total_revenue: agg.totalRevenue,
      total_cost: agg.totalRevenue - agg.totalProfit,
      gross_margin: agg.totalRevenue > 0
        ? agg.totalProfit / agg.totalRevenue
        : 0,
      avg_margin: agg.count > 0 ? agg.marginSum / agg.count : 0,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
}
