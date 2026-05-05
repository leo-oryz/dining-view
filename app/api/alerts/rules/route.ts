import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

const ALERT_TYPES = [
  'flight_spike',
  'holiday_peak',
  'revenue_drop',
  'no_show_spike',
  'low_covers',
] as const

type AlertType = (typeof ALERT_TYPES)[number]

const DEFAULT_THRESHOLDS: Record<AlertType, number | null> = {
  flight_spike: 15,
  holiday_peak: null,
  revenue_drop: 30,
  no_show_spike: 20,
  low_covers: 60,
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const storeId = getStoreId(params)
  const supabase = createServiceClient()

  const { data: existing, error: selErr } = await supabase
    .from('alert_rules')
    .select('alert_type, is_active, threshold')
    .eq('store_id', storeId)

  if (selErr) return apiError(selErr.message, 500)

  const byType = new Map<string, { is_active: boolean; threshold: number | null }>()
  for (const row of existing ?? []) {
    byType.set(row.alert_type, {
      is_active: row.is_active === true,
      threshold: row.threshold == null ? null : Number(row.threshold),
    })
  }

  const missing = ALERT_TYPES.filter((t) => !byType.has(t))
  if (missing.length > 0) {
    const seedRows = missing.map((alert_type) => ({
      store_id: storeId,
      alert_type,
      is_active: true,
      threshold: DEFAULT_THRESHOLDS[alert_type],
    }))
    const { error: seedErr } = await supabase
      .from('alert_rules')
      .upsert(seedRows, { onConflict: 'store_id,alert_type' })
    if (seedErr) return apiError(seedErr.message, 500)
    for (const row of seedRows) {
      byType.set(row.alert_type, { is_active: true, threshold: row.threshold })
    }
  }

  const rules = ALERT_TYPES.map((alert_type) => {
    const r = byType.get(alert_type)!
    return {
      alert_type,
      is_active: r.is_active,
      threshold: r.threshold,
    }
  })

  return apiSuccess(rules)
}

export async function PATCH(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const storeId = getStoreId(params)
  const body = await request.json().catch(() => ({}))
  const alertType = typeof body.alert_type === 'string' ? body.alert_type : null
  if (!alertType || !(ALERT_TYPES as readonly string[]).includes(alertType)) {
    return apiError('Invalid alert_type', 400)
  }

  const update: { store_id: string; alert_type: string; is_active?: boolean; threshold?: number | null } = {
    store_id: storeId,
    alert_type: alertType,
  }
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  if (body.threshold == null) {
    if ('threshold' in body) update.threshold = null
  } else if (typeof body.threshold === 'number' && Number.isFinite(body.threshold)) {
    update.threshold = body.threshold
  }

  if (update.is_active === undefined && !('threshold' in update)) {
    return apiError('Nothing to update', 400)
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('alert_rules')
    .upsert(update, { onConflict: 'store_id,alert_type' })
    .select('alert_type, is_active, threshold')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}
