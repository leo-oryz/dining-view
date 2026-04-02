import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isCloudbedsConfigured } from '@/lib/hotel/cloudbedsClient'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    if (!isCloudbedsConfigured()) {
      return apiError('Cloudbeds API key not configured', 400)
    }

    const params = request.nextUrl.searchParams
    const storeId = getStoreId(params)

    const supabase = createServiceClient()

    // Get all hotel guest mappings for this store
    const { data: mappings, error } = await supabase
      .from('hotel_guest_mappings')
      .select('*')
      .eq('store_id', storeId)
      .order('check_in', { ascending: false })
      .limit(200)

    if (error) return apiError(error.message, 500)

    const totalGuests = mappings?.length || 0
    const matchedGuests = (mappings || []).filter(m => m.ocard_member_id).length
    const conversionRate = totalGuests > 0 ? (matchedGuests / totalGuests * 100) : 0

    // Calculate avg spend for matched guests
    let avgSpend = 0
    if (matchedGuests > 0) {
      const memberIds = (mappings || [])
        .filter(m => m.ocard_member_id)
        .map(m => m.ocard_member_id)

      const { data: orders } = await supabase
        .from('order_items')
        .select('order_total, member_card_id')
        .eq('store_id', storeId)
        .in('member_card_id', memberIds)
        .not('order_total', 'is', null)

      if (orders && orders.length > 0) {
        const totalSpend = orders.reduce((s, o) => s + (Number(o.order_total) || 0), 0)
        // Deduplicate by getting unique order totals per member
        const uniqueOrders = new Set(orders.map(o => `${o.member_card_id}_${o.order_total}`))
        avgSpend = totalSpend / uniqueOrders.size
      }
    }

    return apiSuccess({
      total_guests: totalGuests,
      matched_guests: matchedGuests,
      conversion_rate: Number(conversionRate.toFixed(1)),
      avg_guest_spend: Math.round(avgSpend),
      recent_mappings: (mappings || []).slice(0, 20),
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
