import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { syncSocial } from '@/lib/integrations/social/sync'

export const maxDuration = 300

// Cron: daily at 03:00 HCM (= 20:00 UTC previous day)
// vercel.json: { "path": "/api/cron/sync-social", "schedule": "0 20 * * *" }
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const results = await syncSocial()
    return apiSuccess({ results, syncedAt: new Date().toISOString() })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sync failed', 500)
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
