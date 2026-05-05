import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { runAlertChecks } from '@/lib/alerts/engine'

export const maxDuration = 60

export async function POST() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  if (!profile.store_id) return apiError('No active store on profile', 400)

  try {
    const result = await runAlertChecks(profile.store_id)
    return apiSuccess(result)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Alert run failed', 500)
  }
}
