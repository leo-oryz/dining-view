import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

const SETTING_KEY_API = 'betterhr_api_key'
const SETTING_KEY_COMPANY = 'betterhr_company_id'

// One row per (store, setting_key). The Settings UI manages a single shared
// credential pair, so saving writes the same values to every active store.
export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [SETTING_KEY_API, SETTING_KEY_COMPANY])
    .limit(2)

  if (error) return apiError(error.message, 500)

  // Mask the API key — only return whether it's set + last 4 chars.
  const map: Record<string, string | null> = {}
  for (const row of data ?? []) {
    map[row.setting_key as string] = row.setting_value as string | null
  }
  const apiKey = map[SETTING_KEY_API] ?? null
  return apiSuccess({
    has_api_key: !!apiKey,
    api_key_last4: apiKey ? apiKey.slice(-4) : null,
    company_id: map[SETTING_KEY_COMPANY] ?? null,
    env_fallback: !!process.env.BETTERHR_API_KEY,
  })
}

export async function PUT(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : null
  const companyId = typeof body.company_id === 'string' ? body.company_id.trim() : null

  const supabase = createServiceClient()
  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)
  if (storesErr) return apiError(storesErr.message, 500)
  if (!stores?.length) return apiError('No active stores configured', 400)

  const rows: { store_id: string; setting_key: string; setting_value: string | null; is_secret: boolean }[] = []
  for (const store of stores) {
    if (apiKey !== null) {
      rows.push({
        store_id: store.id,
        setting_key: SETTING_KEY_API,
        setting_value: apiKey || null,
        is_secret: true,
      })
    }
    if (companyId !== null) {
      rows.push({
        store_id: store.id,
        setting_key: SETTING_KEY_COMPANY,
        setting_value: companyId || null,
        is_secret: false,
      })
    }
  }

  if (rows.length === 0) return apiSuccess({ saved: 0 })

  const { error } = await supabase
    .from('store_settings')
    .upsert(rows, { onConflict: 'store_id,setting_key' })
  if (error) return apiError(error.message, 500)

  return apiSuccess({ saved: rows.length })
}
