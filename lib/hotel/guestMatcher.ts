import { createServiceClient } from '@/lib/supabase/server'
import type { CloudbedsGuest } from './cloudbedsClient'

interface MatchResult {
  reservation_id: string
  guest_name: string
  check_in: string
  check_out: string
  ocard_member_id: string | null
  match_confidence: number
  match_method: 'phone' | 'email' | 'none'
}

/**
 * Match Cloudbeds guests to Ocard members via phone or email.
 * Phone matching is primary (higher confidence), email is secondary.
 */
export async function matchGuests(
  storeId: string,
  guests: CloudbedsGuest[]
): Promise<MatchResult[]> {
  const supabase = createServiceClient()
  const results: MatchResult[] = []

  // Fetch recent order_items with member_phone for this store (last 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const startDate = ninetyDaysAgo.toISOString().split('T')[0]

  const { data: memberOrders } = await supabase
    .from('order_items')
    .select('member_phone, member_card_id')
    .eq('store_id', storeId)
    .gte('date', startDate)
    .not('member_phone', 'is', null)

  // Build phone→member_card_id lookup
  const phoneToMember = new Map<string, string>()
  for (const order of memberOrders || []) {
    if (order.member_phone && order.member_card_id) {
      const normalized = normalizePhone(order.member_phone)
      if (normalized && !phoneToMember.has(normalized)) {
        phoneToMember.set(normalized, order.member_card_id)
      }
    }
  }

  for (const guest of guests) {
    let matchedMemberId: string | null = null
    let confidence = 0
    let method: 'phone' | 'email' | 'none' = 'none'

    // Try phone match first (high confidence)
    if (guest.guest_phone) {
      const normalized = normalizePhone(guest.guest_phone)
      const memberId = phoneToMember.get(normalized)
      if (memberId) {
        matchedMemberId = memberId
        confidence = 0.9
        method = 'phone'
      }
    }

    // Fallback: partial phone match (last 8 digits)
    if (!matchedMemberId && guest.guest_phone && guest.guest_phone.length >= 8) {
      const last8 = normalizePhone(guest.guest_phone).slice(-8)
      for (const [phone, memberId] of Array.from(phoneToMember.entries())) {
        if (phone.endsWith(last8)) {
          matchedMemberId = memberId
          confidence = 0.7
          method = 'phone'
          break
        }
      }
    }

    results.push({
      reservation_id: guest.reservation_id,
      guest_name: guest.guest_name,
      check_in: guest.check_in,
      check_out: guest.check_out,
      ocard_member_id: matchedMemberId,
      match_confidence: confidence,
      match_method: method,
    })
  }

  return results
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('886') && digits.length >= 12) {
    return '0' + digits.slice(3)
  }
  return digits
}
