import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const today = new Date().toISOString().slice(0, 10)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('weather_daily')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', today)
      .maybeSingle()

    if (error) return apiError(error.message, 500)

    // No data → return null, not an error
    return apiSuccess(data ?? null)
  } catch (err) {
    console.error('[Weather Today]', err)
    return apiError('Internal server error', 500)
  }
}
