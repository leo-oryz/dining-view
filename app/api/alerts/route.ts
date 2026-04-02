import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { format, subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const storeId = getStoreId(params)
    const days = Number(params.get('days')) || 30

    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('anomaly_alerts')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
