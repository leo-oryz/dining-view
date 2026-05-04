import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { syncHolidays } from '@/lib/integrations/calendarific/sync'

export const maxDuration = 300

export async function POST() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  try {
    const result = await syncHolidays()
    return apiSuccess({ ...result, syncedAt: new Date().toISOString() })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}
