import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { getProductTrend } from '@/lib/products/anomalyDetector'
import { format, subDays } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const productName = decodeURIComponent(name)
    const searchParams = request.nextUrl.searchParams
    const storeId = getStoreId(searchParams)
    const from = searchParams.get('from') || format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const to = searchParams.get('to') || format(new Date(), 'yyyy-MM-dd')

    const supabase = createServiceClient()
    const trend = await getProductTrend(supabase, storeId, productName, from, to)

    return apiSuccess(trend)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
