import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'

// Shape of the row. Keep in sync with migration 026 column list.
type ConfigRow = {
  store_id: string
  business_context: string | null
  labor_target_cost_ratio: number
  labor_pt_healthy_min: number
  labor_pt_healthy_max: number
  labor_ot_monthly_cap: number
  labor_ot_quarterly_cap: number
  labor_ft_low_threshold: number
  labor_pt_high_threshold: number
}

const DEFAULTS: Omit<ConfigRow, 'store_id'> = {
  business_context: null,
  labor_target_cost_ratio: 0.30,
  labor_pt_healthy_min: 0.30,
  labor_pt_healthy_max: 0.40,
  labor_ot_monthly_cap: 46,
  labor_ot_quarterly_cap: 138,
  labor_ft_low_threshold: 140,
  labor_pt_high_threshold: 80,
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('ai_analysis_config')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle()

    if (error) return apiError(error.message, 500)
    // Always return something — merge DB row over defaults.
    return apiSuccess({ ...DEFAULTS, store_id: storeId, ...(data || {}) })
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'owner') return apiError('Forbidden', 403)

    const body = await request.json()
    const storeId = body.store_id || session.store_id

    // Whitelist editable fields and coerce to safe types.
    const toNum = (v: unknown, min: number, max: number): number | null => {
      const n = Number(v)
      if (!isFinite(n)) return null
      return Math.max(min, Math.min(max, n))
    }
    const updates: Partial<ConfigRow> & { updated_by?: string; updated_at?: string } = {
      updated_by: session.id,
      updated_at: new Date().toISOString(),
    }
    if (body.business_context !== undefined) {
      const txt = body.business_context == null ? null : String(body.business_context).slice(0, 500)
      updates.business_context = txt
    }
    const ratioField = (k: keyof ConfigRow) => {
      if (body[k] === undefined) return
      const v = toNum(body[k], 0, 1)
      if (v !== null) (updates[k] as unknown) = v
    }
    const hoursField = (k: keyof ConfigRow, max: number) => {
      if (body[k] === undefined) return
      const v = toNum(body[k], 0, max)
      if (v !== null) (updates[k] as unknown) = Math.round(v)
    }
    ratioField('labor_target_cost_ratio')
    ratioField('labor_pt_healthy_min')
    ratioField('labor_pt_healthy_max')
    hoursField('labor_ot_monthly_cap', 200)
    hoursField('labor_ot_quarterly_cap', 600)
    hoursField('labor_ft_low_threshold', 300)
    hoursField('labor_pt_high_threshold', 300)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('ai_analysis_config')
      .upsert({ store_id: storeId, ...updates }, { onConflict: 'store_id' })
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return apiError(message, 500)
  }
}
