import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchRecentGuests, isCloudbedsConfigured } from '@/lib/hotel/cloudbedsClient'
import { matchGuests } from '@/lib/hotel/guestMatcher'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    if (!isCloudbedsConfigured()) {
      return apiError('Cloudbeds API key not configured', 400)
    }

    const body = await request.json().catch(() => ({}))
    const storeId = body.store_id || DEFAULT_STORE_ID
    const daysBack = body.days_back || 30

    // Fetch guests from Cloudbeds
    const guests = await fetchRecentGuests(daysBack)

    if (guests.length === 0) {
      return apiSuccess({ synced: 0, matched: 0, message: 'No recent guests found' })
    }

    // Match guests to Ocard members
    const matches = await matchGuests(storeId, guests)

    // Upsert into hotel_guest_mappings
    const supabase = createServiceClient()

    const rows = matches.map(m => ({
      store_id: storeId,
      hotel_booking_id: m.reservation_id,
      guest_name: m.guest_name,
      check_in: m.check_in,
      check_out: m.check_out,
      ocard_member_id: m.ocard_member_id,
      match_confidence: m.match_confidence,
      matched_at: m.ocard_member_id ? new Date().toISOString() : null,
    }))

    const { error: dbError } = await supabase
      .from('hotel_guest_mappings')
      .upsert(rows, { onConflict: 'store_id,hotel_booking_id' })

    if (dbError) return apiError(dbError.message, 500)

    const matchedCount = matches.filter(m => m.ocard_member_id).length

    return apiSuccess({
      synced: guests.length,
      matched: matchedCount,
      match_rate: guests.length > 0 ? (matchedCount / guests.length * 100).toFixed(1) + '%' : '0%',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    if (msg.includes('auth error')) {
      return apiError(msg, 401)
    }
    return apiError(msg, 500)
  }
}
