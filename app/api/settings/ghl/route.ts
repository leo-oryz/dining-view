import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

const SETTING_KEY_API = 'ghl_api_key'

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', SETTING_KEY_API)
    .limit(1)

  if (error) return apiError(error.message, 500)
  const apiKey = (data?.[0]?.setting_value as string | null) ?? null
  return apiSuccess({
    has_api_key: !!apiKey,
    api_key_last4: apiKey ? apiKey.slice(-4) : null,
    env_fallback: !!process.env.GHL_LOCATION_API_KEY,
  })
}

export async function PUT(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : null

  const supabase = createServiceClient()
  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)
  if (storesErr) return apiError(storesErr.message, 500)
  if (!stores?.length) return apiError('No active stores configured', 400)

  if (apiKey === null) return apiSuccess({ saved: 0 })

  const rows = stores.map((s) => ({
    store_id: s.id,
    setting_key: SETTING_KEY_API,
    setting_value: apiKey || null,
    is_secret: true,
  }))
  const { error } = await supabase
    .from('store_settings')
    .upsert(rows, { onConflict: 'store_id,setting_key' })
  if (error) return apiError(error.message, 500)
  return apiSuccess({ saved: rows.length })
}
