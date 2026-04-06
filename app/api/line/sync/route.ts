import { syncLineInsight } from '@/lib/line/insightFetcher'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const storeId = getStoreId(url.searchParams)

    const result = await syncLineInsight(storeId)

    return apiSuccess({
      friendCountUpdated: result.friendCountUpdated,
      broadcastsUpdated: result.broadcastsUpdated,
    })
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Internal server error',
      500
    )
  }
}
