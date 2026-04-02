import { NextRequest, NextResponse } from 'next/server'
import { withStoreFilter, applyStoreFilter } from '@/lib/auth/withStoreFilter'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const filter = await withStoreFilter()
  if (!filter.authorized) {
    return NextResponse.json(
      { success: false, data: null, error: 'Unauthorized', timestamp: new Date().toISOString() },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  const supabase = await createServerSupabase()
  let query = supabase
    .from('gsc_brand_search')
    .select('*')
    .order('date', { ascending: false })

  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)

  query = applyStoreFilter(query, filter.storeIds, storeId)
  if (!query) {
    return NextResponse.json(
      { success: false, data: null, error: 'Store access denied', timestamp: new Date().toISOString() },
      { status: 403 }
    )
  }

  const { data, error } = await query.limit(200)

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  })
}
