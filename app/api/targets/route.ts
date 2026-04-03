import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

// GET /api/targets?store_id=...&month=2026-04-01
// or ?start_month=2026-01-01&end_month=2026-12-01 for a range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const month = searchParams.get('month')
    const startMonth = searchParams.get('start_month')
    const endMonth = searchParams.get('end_month')

    const supabase = createServiceClient()

    let query = supabase
      .from('store_monthly_targets')
      .select('*')
      .eq('store_id', storeId)
      .order('month', { ascending: true })

    if (month) {
      query = query.eq('month', month)
    } else {
      if (startMonth) query = query.gte('month', startMonth)
      if (endMonth) query = query.lte('month', endMonth)
    }

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

// POST /api/targets — upsert monthly targets (single or batch)
// Single: { store_id, month, revenue_target }
// Batch:  { store_id, targets: [{ month, revenue_target }, ...] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id } = body

    if (!store_id) {
      return apiError('store_id is required', 400)
    }

    const supabase = createServiceClient()

    // Batch mode
    if (Array.isArray(body.targets)) {
      const rows = body.targets
        .filter((t: { month?: string; revenue_target?: number }) =>
          t.month && t.revenue_target != null && t.revenue_target >= 0
        )
        .map((t: { month: string; revenue_target: number }) => ({
          store_id,
          month: t.month,
          revenue_target: t.revenue_target,
          updated_at: new Date().toISOString(),
        }))

      if (rows.length === 0) {
        return apiError('No valid targets provided', 400)
      }

      const { data, error } = await supabase
        .from('store_monthly_targets')
        .upsert(rows, { onConflict: 'store_id,month' })
        .select()

      if (error) return apiError(error.message, 500)

      return apiSuccess(data)
    }

    // Single mode
    const { month, revenue_target } = body

    if (!month || revenue_target == null) {
      return apiError('month and revenue_target are required', 400)
    }

    if (typeof revenue_target !== 'number' || revenue_target < 0) {
      return apiError('revenue_target must be a non-negative number', 400)
    }

    const { data, error } = await supabase
      .from('store_monthly_targets')
      .upsert(
        {
          store_id,
          month,
          revenue_target,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'store_id,month' }
      )
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
