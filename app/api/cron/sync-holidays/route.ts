import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { syncHolidays } from '@/lib/integrations/calendarific/sync'

export const maxDuration = 300

// Annual cron — schedule "0 0 1 1 *" once configured in vercel.json (Phase 6b).
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const result = await syncHolidays()
    return apiSuccess({ ...result, syncedAt: new Date().toISOString() })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}
