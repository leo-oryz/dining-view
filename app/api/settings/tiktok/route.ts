import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

const SETTING_KEY = 'tiktok_access_token'

export async function GET(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const storeId = request.nextUrl.searchParams.get('store_id')
  if (!storeId) return apiError('store_id is required', 400)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_value')
    .eq('store_id', storeId)
    .eq('setting_key', SETTING_KEY)
    .limit(1)
  if (error) return apiError(error.message, 500)
  const token = (data?.[0]?.setting_value as string | null) ?? null
  return apiSuccess({
    has_token: !!token,
    token_last4: token ? token.slice(-4) : null,
    env_fallback: !!process.env.TIKTOK_ACCESS_TOKEN,
  })
}

export async function PUT(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const storeId = typeof body.store_id === 'string' ? body.store_id : null
  if (!storeId) return apiError('store_id is required', 400)

  const token = typeof body.access_token === 'string' ? body.access_token.trim() : null
  if (token === null) return apiSuccess({ saved: 0 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('store_settings')
    .upsert(
      [{ store_id: storeId, setting_key: SETTING_KEY, setting_value: token || null, is_secret: true }],
      { onConflict: 'store_id,setting_key' },
    )
  if (error) return apiError(error.message, 500)
  return apiSuccess({ saved: 1 })
}
