import { NextRequest, NextResponse } from 'next/server'
import { withStoreFilter, applyStoreFilter } from '@/lib/auth/withStoreFilter'
import { createServerSupabase } from '@/lib/supabase/server'
import { paginatedFetch } from '@/lib/supabase/paginatedFetch'

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

  const { data, error } = await paginatedFetch(supabase, 'gsc_brand_search', {
    order: { column: 'date', ascending: false },
    filters: (q) => {
      if (startDate) q = q.gte('date', startDate)
      if (endDate) q = q.lte('date', endDate)
      const result = applyStoreFilter(q, filter.storeIds, storeId)
      return result || q
    },
  })

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error, timestamp: new Date().toISOString() },
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
