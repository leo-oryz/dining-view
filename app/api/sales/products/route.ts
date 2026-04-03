import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createServiceClient()

    let query = supabase
      .from('product_sales')
      .select('product_name, category, quantity_sold, revenue, gross_margin, total_cost, gross_profit')
      .eq('store_id', storeId)

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    // Aggregate by product_name across dates
    const map = new Map<string, {
      product_name: string
      category: string | null
      quantity_sold: number
      revenue: number
      total_cost: number
      gross_profit: number
    }>()

    for (const row of data || []) {
      const key = row.product_name
      const existing = map.get(key)
      if (existing) {
        existing.quantity_sold += row.quantity_sold ?? 0
        existing.revenue += row.revenue ?? 0
        existing.total_cost += row.total_cost ?? 0
        existing.gross_profit += row.gross_profit ?? 0
      } else {
        map.set(key, {
          product_name: row.product_name,
          category: row.category,
          quantity_sold: row.quantity_sold ?? 0,
          revenue: row.revenue ?? 0,
          total_cost: row.total_cost ?? 0,
          gross_profit: row.gross_profit ?? 0,
        })
      }
    }

    const aggregated = Array.from(map.values())
      .map(item => ({
        ...item,
        gross_margin: item.revenue > 0 ? item.gross_profit / item.revenue : null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 200)

    return apiSuccess(aggregated)
  } catch {
    return apiError('Internal server error', 500)
  }
}
