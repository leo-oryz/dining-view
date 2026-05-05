import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { syncBetterHR } from '@/lib/integrations/betterhr/sync'

export const maxDuration = 300

// Cron: daily at 02:00 HCM (= 19:00 UTC previous day)
// vercel.json: { "path": "/api/cron/sync-betterhr", "schedule": "0 19 * * *" }
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const results = await syncBetterHR()
    return apiSuccess({ results, syncedAt: new Date().toISOString() })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}
