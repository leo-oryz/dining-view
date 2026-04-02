import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const storeId = getStoreId(params)
    const startDate = params.get('start_date')
    const endDate = params.get('end_date')

    const supabase = createServiceClient()

    // Fetch delivery sales
    let deliveryQuery = supabase
      .from('delivery_sales')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })

    if (startDate) deliveryQuery = deliveryQuery.gte('date', startDate)
    if (endDate) deliveryQuery = deliveryQuery.lte('date', endDate)

    const { data: deliveryData, error: deliveryError } = await deliveryQuery

    if (deliveryError) return apiError(deliveryError.message, 500)

    // Fetch dine-in sales for the same period (for comparison)
    let dineinQuery = supabase
      .from('daily_sales')
      .select('date, net_sales, revenue, guests')
      .eq('store_id', storeId)
      .order('date', { ascending: true })

    if (startDate) dineinQuery = dineinQuery.gte('date', startDate)
    if (endDate) dineinQuery = dineinQuery.lte('date', endDate)

    const { data: dineinData, error: dineinError } = await dineinQuery

    if (dineinError) return apiError(dineinError.message, 500)

    // Build comparison: merge by date
    const dineinMap = new Map<string, { net_sales: number; guests: number }>()
    for (const row of dineinData || []) {
      dineinMap.set(row.date, {
        net_sales: Number(row.net_sales) || 0,
        guests: Number(row.guests) || 0,
      })
    }

    const comparison = Array.from(
      new Set([
        ...(deliveryData || []).map(d => d.date),
        ...(dineinData || []).map(d => d.date),
      ])
    ).sort().map(date => {
      const delivery = (deliveryData || []).filter(d => d.date === date)
      const deliveryRevenue = delivery.reduce((sum, d) => sum + (Number(d.net_revenue) || Number(d.gross_revenue) || 0), 0)
      const dinein = dineinMap.get(date)
      return {
        date,
        dine_in_revenue: dinein?.net_sales || 0,
        delivery_revenue: deliveryRevenue,
        total_revenue: (dinein?.net_sales || 0) + deliveryRevenue,
      }
    })

    // Summary KPIs
    const totalGross = (deliveryData || []).reduce((s, d) => s + (Number(d.gross_revenue) || 0), 0)
    const totalNet = (deliveryData || []).reduce((s, d) => s + (Number(d.net_revenue) || 0), 0)
    const totalOrders = (deliveryData || []).reduce((s, d) => s + (Number(d.order_count) || 0), 0)
    const avgCommRate = (deliveryData || []).length > 0
      ? (deliveryData || []).reduce((s, d) => s + (Number(d.commission_rate) || 0), 0) / deliveryData!.length
      : 0
    const avgCancelRate = (deliveryData || []).length > 0
      ? (deliveryData || []).reduce((s, d) => s + (Number(d.cancellation_rate) || 0), 0) / deliveryData!.length
      : 0
    const avgRating = (deliveryData || []).filter(d => d.platform_rating).length > 0
      ? (deliveryData || []).reduce((s, d) => s + (Number(d.platform_rating) || 0), 0) /
        (deliveryData || []).filter(d => d.platform_rating).length
      : null

    return apiSuccess({
      delivery: deliveryData || [],
      comparison,
      kpis: {
        total_gross_revenue: totalGross,
        total_net_revenue: totalNet,
        total_orders: totalOrders,
        avg_commission_rate: avgCommRate,
        avg_cancellation_rate: avgCancelRate,
        avg_rating: avgRating,
      },
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
