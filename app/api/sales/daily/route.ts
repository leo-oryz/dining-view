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
      .from('daily_sales')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: false })

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query.limit(366)

    if (error) return apiError(error.message, 500)

    // Fill in orders from hourly_sales transaction_count if orders is null
    const datesNeedingOrders = (data || []).filter(d => d.orders == null).map(d => d.date)

    if (datesNeedingOrders.length > 0) {
      const { data: hourlyData } = await supabase
        .from('hourly_sales')
        .select('date, transaction_count')
        .eq('store_id', storeId)
        .in('date', datesNeedingOrders)

      if (hourlyData && hourlyData.length > 0) {
        // Sum transaction_count per date
        const ordersByDate: Record<string, number> = {}
        for (const h of hourlyData) {
          ordersByDate[h.date] = (ordersByDate[h.date] || 0) + (h.transaction_count || 0)
        }

        // Merge into daily_sales data
        for (const row of data || []) {
          if (row.orders == null && ordersByDate[row.date] != null) {
            row.orders = ordersByDate[row.date]
          }
        }
      }
    }

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
