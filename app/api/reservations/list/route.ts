import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

const APP_TZ_OFFSET = '+07:00'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 200

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')
    const country = searchParams.get('country')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    )

    const supabase = createServiceClient()

    let query = supabase
      .from('reservations')
      .select(
        'id, reserved_at, party_size, status, source_channel, guest_country, memo',
        { count: 'exact' }
      )
      .eq('store_id', storeId)
      .order('reserved_at', { ascending: false })

    if (from) query = query.gte('reserved_at', `${from}T00:00:00${APP_TZ_OFFSET}`)
    if (to) query = query.lte('reserved_at', `${to}T23:59:59${APP_TZ_OFFSET}`)
    if (status && status !== 'all') query = query.eq('status', status)
    if (country && country !== 'all') query = query.eq('guest_country', country)

    const fromIdx = (page - 1) * limit
    const toIdx = fromIdx + limit - 1

    const { data, error, count } = await query.range(fromIdx, toIdx)
    if (error) return apiError(error.message, 500)

    return apiSuccess({
      rows: data ?? [],
      page,
      limit,
      total: count ?? 0,
      total_pages: count ? Math.ceil(count / limit) : 0,
    })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500)
  }
}
