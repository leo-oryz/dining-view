import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { syncAllStores } from '@/lib/integrations/tablecheck/sync'

export const maxDuration = 300

// Cron: every 30 minutes
// vercel.json: { "crons": [{ "path": "/api/cron/sync-tablecheck", "schedule": "*/30 * * * *" }] }
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const results = await syncAllStores()
    return apiSuccess({ results, syncedAt: new Date().toISOString() })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}
