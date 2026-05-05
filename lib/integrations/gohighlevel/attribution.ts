import type { SupabaseClient } from '@supabase/supabase-js'

// Approximates email -> reservation attribution by matching reservations
// whose source_channel mentions email + utm_campaign against campaign names.
// This is intentionally fuzzy — the real attribution would require capturing
// utm_campaign in the booking flow. Surface a disclaimer in the UI.

interface Campaign {
  id: string
  name: string
  sent_at: string | null
}

interface ReservationCandidate {
  id: string
  reserved_at: string
  source_channel: string | null
}

function extractUtmCampaign(channel: string | null): string | null {
  if (!channel) return null
  const lc = channel.toLowerCase()
  // Form 1: "utm_source=email&utm_campaign=spring_promo"
  const match = lc.match(/utm_campaign=([^&\s]+)/)
  if (match) return decodeURIComponent(match[1])
  // Form 2: source_channel could simply be "email:spring_promo"
  if (lc.startsWith('email:')) return lc.slice('email:'.length)
  return null
}

function isEmailSource(channel: string | null): boolean {
  if (!channel) return false
  const lc = channel.toLowerCase()
  return lc === 'email' || lc.includes('utm_source=email') || lc.startsWith('email:')
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export interface AttributionResult {
  store_id: string
  matched: number
  campaigns_considered: number
}

// Look back this many days from a campaign send to attribute reservations.
const ATTRIBUTION_WINDOW_DAYS = 14

export async function runAttribution(
  supabase: SupabaseClient,
  storeId: string,
): Promise<AttributionResult> {
  const result: AttributionResult = {
    store_id: storeId,
    matched: 0,
    campaigns_considered: 0,
  }

  const { data: campaigns, error: campErr } = await supabase
    .from('email_campaigns')
    .select('id, name, sent_at')
    .eq('store_id', storeId)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(50)

  if (campErr) throw campErr
  if (!campaigns?.length) return result
  result.campaigns_considered = campaigns.length

  for (const campaign of campaigns as Campaign[]) {
    if (!campaign.sent_at) continue
    const sentDate = new Date(campaign.sent_at)
    const sentMs = sentDate.getTime()
    if (!Number.isFinite(sentMs)) continue
    const windowEnd = new Date(sentMs + ATTRIBUTION_WINDOW_DAYS * 86_400_000)

    const { data: reservations, error: resErr } = await supabase
      .from('reservations')
      .select('id, reserved_at, source_channel')
      .eq('store_id', storeId)
      .gte('reserved_at', campaign.sent_at)
      .lte('reserved_at', windowEnd.toISOString())

    if (resErr) {
      console.warn(`[GHL attribution] reservations lookup failed for ${campaign.id}:`, resErr.message)
      continue
    }

    const campaignKey = normalizeName(campaign.name)
    const rows: { store_id: string; campaign_id: string; reservation_id: string; utm_campaign: string }[] = []

    for (const r of (reservations ?? []) as ReservationCandidate[]) {
      if (!isEmailSource(r.source_channel)) continue
      const utm = extractUtmCampaign(r.source_channel)
      // Match: explicit utm_campaign param matching the campaign's name slug,
      // or source_channel === 'email' (best-effort, included in attribution).
      const matchedByUtm = utm && (normalizeName(utm) === campaignKey || campaignKey.includes(normalizeName(utm)))
      const matchedByPlainEmail = !utm && r.source_channel?.toLowerCase() === 'email'
      if (matchedByUtm || matchedByPlainEmail) {
        rows.push({
          store_id: storeId,
          campaign_id: campaign.id,
          reservation_id: r.id,
          utm_campaign: utm ?? campaign.name,
        })
      }
    }

    if (rows.length) {
      const { error } = await supabase
        .from('email_bookings')
        .upsert(rows, { onConflict: 'store_id,campaign_id,reservation_id', ignoreDuplicates: true })
      if (error) {
        console.warn(`[GHL attribution] upsert failed for ${campaign.id}:`, error.message)
      } else {
        result.matched += rows.length
      }
    }
  }

  return result
}
