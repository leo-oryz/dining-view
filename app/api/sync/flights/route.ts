import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { syncFlightCapacity } from '@/lib/integrations/aviationstack/sync'
import { runAlertChecksForAllStores } from '@/lib/alerts/engine'

export const maxDuration = 300

export async function POST() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  try {
    const flights = await syncFlightCapacity()
    const alerts = await runAlertChecksForAllStores()
    return apiSuccess({ flights, alerts, syncedAt: new Date().toISOString() })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}
