import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { format, subDays } from 'date-fns'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const storeId = getStoreId(params)
    const supabase = createServiceClient()

    // Legacy path: dashboard alerts page calls ?days=N for anomaly_alerts
    const daysParam = params.get('days')
    if (daysParam) {
      const days = Number(daysParam) || 30
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('anomaly_alerts')
        .select('*')
        .eq('store_id', storeId)
        .gte('created_at', `${startDate}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) return apiError(error.message, 500)
      return apiSuccess(data)
    }

    // Phase 6a: alert_history paginated
    const unread = params.get('unread') === 'true'
    const page = Math.max(1, Number(params.get('page')) || 1)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('alert_history')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId)
      .order('triggered_at', { ascending: false })
      .range(from, to)

    if (unread) query = query.eq('is_read', false)

    const { data, count, error } = await query
    if (error) return apiError(error.message, 500)

    return apiSuccess({
      items: data ?? [],
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
