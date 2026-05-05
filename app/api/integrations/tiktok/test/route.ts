import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTTAccount, isTTConfigured } from '@/lib/integrations/social/tiktok/client'

const KEY_TOKEN = 'tiktok_access_token'

async function resolveToken(body: { store_id?: string; access_token?: string }): Promise<string | undefined> {
  const fromBody = body.access_token?.trim() || undefined
  if (fromBody) return fromBody
  const storeId = body.store_id?.trim()
  if (!storeId) return undefined

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('store_settings')
    .select('setting_value')
    .eq('store_id', storeId)
    .eq('setting_key', KEY_TOKEN)
    .limit(1)
  return (data?.[0]?.setting_value as string | null) || undefined
}

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
  const token = await resolveToken(body)
  const result = await run(token)
  return apiSuccess(result)
}
