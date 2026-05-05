import { NextRequest } from 'next/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storeId = getStoreId(searchParams)
  const date = searchParams.get('date')
  if (!date || !DATE_REGEX.test(date)) {
    return apiError('Invalid or missing date (YYYY-MM-DD required)', 400)
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('daily_manual_metrics')
    .select('*')
    .eq('store_id', storeId)
    .eq('date', date)
    .maybeSingle()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? null)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)

  let body: {
    store_id?: string
    date?: string
    phone_inquiries?: number
    walk_ins_estimate?: number
    notes?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const storeId = body.store_id
  const date = body.date
  if (!storeId) return apiError('store_id is required', 400)
  if (!date || !DATE_REGEX.test(date)) {
    return apiError('Invalid or missing date (YYYY-MM-DD required)', 400)
  }

  const phoneInquiries = Math.max(0, Math.floor(Number(body.phone_inquiries ?? 0)))
  const walkIns = Math.max(0, Math.floor(Number(body.walk_ins_estimate ?? 0)))
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('daily_manual_metrics')
    .upsert(
      {
        store_id: storeId,
        date,
        phone_inquiries: phoneInquiries,
        walk_ins_estimate: walkIns,
        notes,
        entered_by: session.auth_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,date' },
    )
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}
