import type { GHLCampaign, GHLCampaignStats } from './types'

export interface EmailCampaignRow {
  store_id: string
  ghl_campaign_id: string
  name: string
  sent_at: string | null
  sends: number
  deliveries: number
  opens: number
  clicks: number
  unsubscribes: number
  bounces: number
  open_rate: number | null
  ctr: number | null
  updated_at: string
}

function pickSentAt(c: GHLCampaign): string | null {
  return c.sentAt ?? c.dateAdded ?? c.createdAt ?? null
}

function flattenStats(s: GHLCampaignStats | null | undefined) {
  const nested = s?.stats ?? {}
  return {
    sends: s?.sends ?? nested.sends ?? 0,
    deliveries: s?.delivered ?? s?.deliveries ?? nested.delivered ?? nested.deliveries ?? 0,
    opens: s?.uniqueOpens ?? s?.opens ?? nested.uniqueOpens ?? nested.opens ?? 0,
    clicks: s?.uniqueClicks ?? s?.clicks ?? nested.uniqueClicks ?? nested.clicks ?? 0,
    unsubscribes: s?.unsubscribes ?? nested.unsubscribes ?? 0,
    bounces: s?.bounces ?? nested.bounces ?? 0,
  }
}

export function transformCampaign(
  campaign: GHLCampaign,
  stats: GHLCampaignStats | null,
  storeId: string,
): EmailCampaignRow {
  const flat = flattenStats(stats)
  const denom = flat.deliveries || flat.sends || 0
  const openRate = denom > 0 ? Math.round((flat.opens / denom) * 10000) / 100 : null
  const ctr = denom > 0 ? Math.round((flat.clicks / denom) * 10000) / 100 : null

  return {
    store_id: storeId,
    ghl_campaign_id: String(campaign.id),
    name: campaign.name ?? 'Untitled campaign',
    sent_at: pickSentAt(campaign),
    sends: flat.sends,
    deliveries: flat.deliveries,
    opens: flat.opens,
    clicks: flat.clicks,
    unsubscribes: flat.unsubscribes,
    bounces: flat.bounces,
    open_rate: openRate,
    ctr,
    updated_at: new Date().toISOString(),
  }
}
