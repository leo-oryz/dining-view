import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { fetchTTAccount, isTTConfigured } from '@/lib/integrations/social/tiktok/client'

async function run(token?: string) {
  if (!token && !isTTConfigured()) {
    return { success: false, detail: 'TikTok: pending approval — no access token configured' }
  }
  try {
    const account = await fetchTTAccount(token ? { accessToken: token } : undefined)
    if (!account) return { success: false, detail: 'TikTok: empty response from /business/get/' }
    const name = account.display_name || account.username || account.business_id || 'unknown'
    return { success: true, detail: `TikTok OK — ${name}, ${account.followers_count ?? 0} followers` }
  } catch (err) {
    return { success: false, detail: err instanceof Error ? err.message : 'Test failed' }
  }
}

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const result = await run()
  return apiSuccess(result)
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const body = await request.json().catch(() => ({}))
  const token = typeof body.access_token === 'string' && body.access_token.trim() ? body.access_token.trim() : undefined
  const result = await run(token)
  return apiSuccess(result)
}
