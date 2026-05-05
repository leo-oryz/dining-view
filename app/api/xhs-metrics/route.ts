import { NextRequest } from 'next/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storeId = getStoreId(searchParams)
  const date = searchParams.get('date')

  const supabase = await createServerSupabase()
  if (date) {
    if (!DATE_REGEX.test(date)) {
      return apiError('Invalid date (YYYY-MM-DD required)', 400)
    }
    const { data, error } = await supabase
      .from('xhs_manual_metrics')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', date)
      .maybeSingle()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? null)
  }

  // List recent entries
  const { data, error } = await supabase
    .from('xhs_manual_metrics')
    .select('*')
    .eq('store_id', storeId)
    .order('date', { ascending: false })
    .limit(60)
  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)

  let body: {
    store_id?: string
    date?: string
    followers?: number | null
    total_likes?: number | null
    total_comments?: number | null
    top_post_title?: string | null
    top_post_views?: number | null
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

  function nullableInt(v: number | null | undefined): number | null {
    if (v === null || v === undefined) return null
    const n = Math.floor(Number(v))
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('xhs_manual_metrics')
    .upsert(
      {
        store_id: storeId,
        date,
        followers: nullableInt(body.followers),
        total_likes: nullableInt(body.total_likes),
        total_comments: nullableInt(body.total_comments),
        top_post_title:
          typeof body.top_post_title === 'string' ? body.top_post_title.trim() || null : null,
        top_post_views: nullableInt(body.top_post_views),
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
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
