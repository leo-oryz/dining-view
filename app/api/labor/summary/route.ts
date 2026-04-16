import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supabase = createServiceClient()

    let query = supabase
      .from('labor_daily_summary')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query.limit(366)
    if (error) return apiError(error.message, 500)

    // Calculate 7-day moving average for revenue_per_hour
    const rows = (data || []).map((row, idx, arr) => {
      const windowStart = Math.max(0, idx - 6)
      const window = arr.slice(windowStart, idx + 1).filter(r => r.revenue_per_hour != null)
      const ma7 = window.length > 0
        ? Math.round(window.reduce((s, r) => s + Number(r.revenue_per_hour), 0) / window.length * 100) / 100
        : null

      return { ...row, revenue_per_hour_ma7: ma7 }
    })

    return apiSuccess(rows)
  } catch {
    return apiError('Internal server error', 500)
  }
}
