import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

const SETTING_KEY_API = 'betterhr_api_key'
const SETTING_KEY_COMPANY = 'betterhr_company_id'

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
    .in('setting_key', [SETTING_KEY_API, SETTING_KEY_COMPANY])

  if (error) return apiError(error.message, 500)

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
  const storeId = typeof body.store_id === 'string' ? body.store_id : null
  if (!storeId) return apiError('store_id is required', 400)

  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : null
  const companyId = typeof body.company_id === 'string' ? body.company_id.trim() : null

  const rows: { store_id: string; setting_key: string; setting_value: string | null; is_secret: boolean }[] = []
  if (apiKey !== null) {
    rows.push({ store_id: storeId, setting_key: SETTING_KEY_API, setting_value: apiKey || null, is_secret: true })
  }
  if (companyId !== null) {
    rows.push({ store_id: storeId, setting_key: SETTING_KEY_COMPANY, setting_value: companyId || null, is_secret: false })
  }

  if (rows.length === 0) return apiSuccess({ saved: 0 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('store_settings')
    .upsert(rows, { onConflict: 'store_id,setting_key' })
  if (error) return apiError(error.message, 500)

  return apiSuccess({ saved: rows.length })
}
