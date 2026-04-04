import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createServiceClient()

    let query = supabase
      .from('kol_collaborations')
      .select('*, kol_posts(*)')
      .eq('store_id', storeId)
      .order('collaboration_date', { ascending: false })

    if (startDate) query = query.gte('collaboration_date', startDate)
    if (endDate) query = query.lte('collaboration_date', endDate)

    const { data, error } = await query

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      store_id,
      kol_name,
      kol_handle,
      collaboration_date,
      featured_products,
      collaboration_fee,
      fee_type,
      responsible_staff,
      notes,
    } = body

    if (!kol_name || !collaboration_date) {
      return apiError('kol_name and collaboration_date are required', 400)
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('kol_collaborations')
      .insert({
        store_id: store_id || '36d016c4-7584-4c0f-a3e8-9562089d57f8',
        kol_name,
        kol_handle: kol_handle || null,
        collaboration_date,
        featured_products: featured_products || [],
        collaboration_fee: collaboration_fee || null,
        fee_type: fee_type || null,
        responsible_staff: responsible_staff || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
