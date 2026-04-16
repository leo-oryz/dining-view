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
      .from('labor_hourly')
      .select('date, time_slot_start, staff_count, revenue, revenue_per_staff')
      .eq('store_id', storeId)
      .order('date')
      .order('time_slot_start')

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query.limit(5000)
    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
