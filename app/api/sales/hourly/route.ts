import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const date = searchParams.get('date')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createServiceClient()

    let query = supabase
      .from('hourly_sales')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: false })
      .order('hour', { ascending: true })

    if (date) {
      query = query.eq('date', date)
    } else {
      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)
    }

    const { data, error } = await query.limit(500)

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
