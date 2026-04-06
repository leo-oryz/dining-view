import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const days = parseInt(searchParams.get('days') || '30', 10)

    const supabase = createServiceClient()

    // Calculate start date
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]

    // Get all records with friend_count_after (includes snapshots)
    const { data: friendData, error: fErr } = await supabase
      .from('line_broadcasts')
      .select('broadcast_date, friend_count_after')
      .eq('store_id', storeId)
      .not('friend_count_after', 'is', null)
      .gte('broadcast_date', startStr)
      .order('broadcast_date')

    if (fErr) return apiError(fErr.message, 500)

    // Get broadcast dates (non-snapshot) for marking on chart
    const { data: broadcastDates, error: bErr } = await supabase
      .from('line_broadcasts')
      .select('broadcast_date')
      .eq('store_id', storeId)
      .neq('title', '__follower_snapshot__')
      .gte('broadcast_date', startStr)
      .order('broadcast_date')

    if (bErr) return apiError(bErr.message, 500)

    const broadcastDateSet = new Set((broadcastDates || []).map(b => b.broadcast_date))

    // Deduplicate by date (keep the highest friend_count per date)
    const dateMap = new Map<string, number>()
    for (const row of friendData || []) {
      const existing = dateMap.get(row.broadcast_date)
      const val = row.friend_count_after as number
      if (!existing || val > existing) {
        dateMap.set(row.broadcast_date, val)
      }
    }

    const trend = Array.from(dateMap.entries()).map(([date, friends]) => ({
      date,
      friends,
      has_broadcast: broadcastDateSet.has(date),
    }))

    return apiSuccess(trend)
  } catch {
    return apiError('Internal server error', 500)
  }
}
