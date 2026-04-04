import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return apiError('from and to are required')
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('weather_daily')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (error) return apiError(error.message, 500)

    return apiSuccess(data ?? [])
  } catch (err) {
    console.error('[Weather Range]', err)
    return apiError('Internal server error', 500)
  }
}
