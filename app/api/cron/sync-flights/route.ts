import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { syncFlightCapacity } from '@/lib/integrations/aviationstack/sync'
import { runAlertChecksForAllStores } from '@/lib/alerts/engine'

export const maxDuration = 300

// Daily cron — "0 20 * * *" (03:00 HCM = 20:00 UTC), wired in vercel.json in Phase 6b.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const flightResult = await syncFlightCapacity()
    const alertResults = await runAlertChecksForAllStores()
    return apiSuccess({
      flights: flightResult,
      alerts: alertResults,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}
