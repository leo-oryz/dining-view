import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { getTopProductPairs } from '@/lib/ai/basketAnalysis'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const startDate = searchParams.get('start_date') ?? undefined
    const endDate = searchParams.get('end_date') ?? undefined
    const limit = Math.min(Number(searchParams.get('limit')) || 15, 50)

    const supabase = createServiceClient()
    const result = await getTopProductPairs(supabase, storeId, {
      startDate,
      endDate,
      limit,
    })

    return apiSuccess(result)
  } catch {
    return apiError('Internal server error', 500)
  }
}
