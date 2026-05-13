import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveLocationId } from '@/lib/integrations/gohighlevel/client'

const SETTING_KEY_API = 'ghl_api_key'
const SETTING_KEY_LOCATION = 'ghl_location_id'

export async function GET(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const storeId = request.nextUrl.searchParams.get('store_id')
  if (!storeId) return apiError('store_id is required', 400)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', [SETTING_KEY_API, SETTING_KEY_LOCATION])

  if (error) return apiError(error.message, 500)
  const byKey = new Map((data ?? []).map((r) => [r.setting_key as string, r.setting_value as string | null]))
  const apiKey = byKey.get(SETTING_KEY_API) ?? null
  const savedLocation = byKey.get(SETTING_KEY_LOCATION) ?? null
  const derivedLocation = apiKey ? resolveLocationId(apiKey) ?? null : null

  return apiSuccess({
    has_api_key: !!apiKey,
    api_key_last4: apiKey ? apiKey.slice(-4) : null,
    location_id: savedLocation,
    derived_location_id: derivedLocation,
    env_fallback: !!process.env.GHL_LOCATION_API_KEY,
  })
}

export async function PUT(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const storeId = typeof body.store_id === 'string' ? body.store_id : null
  if (!storeId) return apiError('store_id is required', 400)

  const supabase = createServiceClient()
  const rows: { store_id: string; setting_key: string; setting_value: string | null; is_secret: boolean }[] = []

  if (typeof body.api_key === 'string') {
    const trimmed = body.api_key.trim()
    rows.push({
      store_id: storeId,
      setting_key: SETTING_KEY_API,
      setting_value: trimmed || null,
      is_secret: true,
    })
  }
  if (typeof body.location_id === 'string') {
    const trimmed = body.location_id.trim()
    rows.push({
      store_id: storeId,
      setting_key: SETTING_KEY_LOCATION,
      setting_value: trimmed || null,
      is_secret: false,
    })
  }

  if (rows.length === 0) return apiSuccess({ saved: 0 })

  const { error } = await supabase
    .from('store_settings')
    .upsert(rows, { onConflict: 'store_id,setting_key' })
  if (error) return apiError(error.message, 500)
  return apiSuccess({ saved: rows.length })
}
