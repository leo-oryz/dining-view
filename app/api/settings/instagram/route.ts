import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

const KEYS = {
  IG_TOKEN: 'instagram_access_token',
  IG_USER_ID: 'instagram_user_id',
  FB_TOKEN: 'facebook_page_access_token',
  FB_PAGE_ID: 'facebook_page_id',
} as const

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .in('setting_key', Object.values(KEYS))
    .limit(20)

  if (error) return apiError(error.message, 500)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.setting_value) map.set(row.setting_key as string, row.setting_value as string)
  }
  const igToken = map.get(KEYS.IG_TOKEN) ?? null
  const fbToken = map.get(KEYS.FB_TOKEN) ?? null

  return apiSuccess({
    has_ig_token: !!igToken,
    ig_token_last4: igToken ? igToken.slice(-4) : null,
    ig_user_id: map.get(KEYS.IG_USER_ID) ?? null,
    has_fb_token: !!fbToken,
    fb_token_last4: fbToken ? fbToken.slice(-4) : null,
    fb_page_id: map.get(KEYS.FB_PAGE_ID) ?? null,
    env_fallback:
      !!process.env.INSTAGRAM_ACCESS_TOKEN || !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  })
}

export async function PUT(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const igToken = typeof body.ig_token === 'string' ? body.ig_token.trim() : null
  const igUserId = typeof body.ig_user_id === 'string' ? body.ig_user_id.trim() : null
  const fbToken = typeof body.fb_token === 'string' ? body.fb_token.trim() : null
  const fbPageId = typeof body.fb_page_id === 'string' ? body.fb_page_id.trim() : null

  const supabase = createServiceClient()
  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)
  if (storesErr) return apiError(storesErr.message, 500)
  if (!stores?.length) return apiError('No active stores configured', 400)

  type Row = { store_id: string; setting_key: string; setting_value: string | null; is_secret: boolean }
  const rows: Row[] = []
  for (const store of stores) {
    if (igToken !== null) rows.push({ store_id: store.id, setting_key: KEYS.IG_TOKEN, setting_value: igToken || null, is_secret: true })
    if (igUserId !== null) rows.push({ store_id: store.id, setting_key: KEYS.IG_USER_ID, setting_value: igUserId || null, is_secret: false })
    if (fbToken !== null) rows.push({ store_id: store.id, setting_key: KEYS.FB_TOKEN, setting_value: fbToken || null, is_secret: true })
    if (fbPageId !== null) rows.push({ store_id: store.id, setting_key: KEYS.FB_PAGE_ID, setting_value: fbPageId || null, is_secret: false })
  }

  if (rows.length === 0) return apiSuccess({ saved: 0 })

  const { error } = await supabase
    .from('store_settings')
    .upsert(rows, { onConflict: 'store_id,setting_key' })
  if (error) return apiError(error.message, 500)
  return apiSuccess({ saved: rows.length })
}
