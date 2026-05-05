import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

const CALENDARIFIC_KEY = 'calendarific_api_key'
const AVIATIONSTACK_KEY = 'aviationstack_api_key'

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [CALENDARIFIC_KEY, AVIATIONSTACK_KEY])
    .limit(50)

  if (error) return apiError(error.message, 500)

  const cal = (data ?? []).find((r) => r.setting_key === CALENDARIFIC_KEY)?.setting_value as string | null | undefined
  const av = (data ?? []).find((r) => r.setting_key === AVIATIONSTACK_KEY)?.setting_value as string | null | undefined

  return apiSuccess({
    calendarific: {
      has_key: !!cal,
      last4: cal ? String(cal).slice(-4) : null,
      env_fallback: !!process.env.CALENDARIFIC_API_KEY,
    },
    aviationstack: {
      has_key: !!av,
      last4: av ? String(av).slice(-4) : null,
      env_fallback: !!process.env.AVIATIONSTACK_API_KEY,
    },
    monitored_airport: process.env.AVIATIONSTACK_AIRPORT ?? 'SGN',
  })
}

export async function PUT(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const calKey = typeof body.calendarific_api_key === 'string' ? body.calendarific_api_key.trim() : null
  const avKey = typeof body.aviationstack_api_key === 'string' ? body.aviationstack_api_key.trim() : null

  if (calKey === null && avKey === null) {
    return apiError('Nothing to update', 400)
  }

  const supabase = createServiceClient()
  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)
  if (storesErr) return apiError(storesErr.message, 500)
  if (!stores?.length) return apiError('No active stores configured', 400)

  const rows: { store_id: string; setting_key: string; setting_value: string | null; is_secret: boolean }[] = []
  for (const s of stores) {
    if (calKey !== null) {
      rows.push({
        store_id: s.id,
        setting_key: CALENDARIFIC_KEY,
        setting_value: calKey || null,
        is_secret: true,
      })
    }
    if (avKey !== null) {
      rows.push({
        store_id: s.id,
        setting_key: AVIATIONSTACK_KEY,
        setting_value: avKey || null,
        is_secret: true,
      })
    }
  }

  const { error } = await supabase
    .from('store_settings')
    .upsert(rows, { onConflict: 'store_id,setting_key' })
  if (error) return apiError(error.message, 500)
  return apiSuccess({ saved: rows.length })
}
