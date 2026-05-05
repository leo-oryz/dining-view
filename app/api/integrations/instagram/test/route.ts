import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchIGProfile } from '@/lib/integrations/social/instagram/client'
import { fetchFBProfile } from '@/lib/integrations/social/facebook/client'

const KEYS = {
  IG_TOKEN: 'instagram_access_token',
  IG_USER_ID: 'instagram_user_id',
  FB_TOKEN: 'facebook_page_access_token',
  FB_PAGE_ID: 'facebook_page_id',
} as const

interface TestBody {
  store_id?: string
  ig_token?: string
  ig_user_id?: string
  fb_token?: string
  fb_page_id?: string
}

interface ResolvedCreds {
  igToken?: string
  igUserId?: string
  fbToken?: string
  fbPageId?: string
}

async function resolveCreds(body: TestBody): Promise<ResolvedCreds> {
  const fromBody: ResolvedCreds = {
    igToken: body.ig_token?.trim() || undefined,
    igUserId: body.ig_user_id?.trim() || undefined,
    fbToken: body.fb_token?.trim() || undefined,
    fbPageId: body.fb_page_id?.trim() || undefined,
  }
  const storeId = body.store_id?.trim()
  if (!storeId) return fromBody
  const allFilled = fromBody.igToken && fromBody.igUserId && fromBody.fbToken && fromBody.fbPageId
  if (allFilled) return fromBody

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', Object.values(KEYS))
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.setting_value) map.set(row.setting_key as string, row.setting_value as string)
  }
  return {
    igToken: fromBody.igToken ?? map.get(KEYS.IG_TOKEN),
    igUserId: fromBody.igUserId ?? map.get(KEYS.IG_USER_ID),
    fbToken: fromBody.fbToken ?? map.get(KEYS.FB_TOKEN),
    fbPageId: fromBody.fbPageId ?? map.get(KEYS.FB_PAGE_ID),
  }
}

async function run(body: TestBody) {
  const creds = await resolveCreds(body)
  const detail: string[] = []
  let success = true
  try {
    const ig = await fetchIGProfile({
      accessToken: creds.igToken,
      igUserId: creds.igUserId,
    })
    if (ig?.id) {
      detail.push(`Instagram OK — @${ig.username ?? ig.id}, ${ig.followers_count ?? 0} followers`)
    } else {
      detail.push('Instagram: not configured')
    }
  } catch (err) {
    success = false
    detail.push(`Instagram error: ${err instanceof Error ? err.message : 'unknown'}`)
  }
  try {
    const fb = await fetchFBProfile({
      accessToken: creds.fbToken,
      pageId: creds.fbPageId,
    })
    if (fb?.id) {
      const followers = fb.followers_count ?? fb.fan_count ?? 0
      detail.push(`Facebook OK — ${fb.name ?? fb.id}, ${followers} followers`)
    } else {
      detail.push('Facebook: not configured')
    }
  } catch (err) {
    success = false
    detail.push(`Facebook error: ${err instanceof Error ? err.message : 'unknown'}`)
  }
  return { success, detail: detail.join(' · ') }
}

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const result = await run({})
  return apiSuccess(result)
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const body = (await request.json().catch(() => ({}))) as TestBody
  const result = await run(body)
  return apiSuccess(result)
}
