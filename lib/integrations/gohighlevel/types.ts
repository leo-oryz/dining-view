// GoHighLevel email campaign API response shapes.
// ⚠️ Field names are best-guess based on GHL public docs.
// Verify against the actual responses once a Location API key is configured
// and adjust the transformer accordingly.

export interface GHLCampaign {
  id: string
  name: string
  // ⚠️ verify field name — GHL has used both `dateAdded` and `createdAt`
  dateAdded?: string
  createdAt?: string
  // Some campaign types report a sent_at directly:
  sentAt?: string
  status?: string // 'sent' | 'draft' | 'scheduled' etc.
  type?: string // 'email' | 'sms' | ...
  locationId?: string
}

export interface GHLCampaignStats {
  campaignId: string
  // ⚠️ verify — GHL stats endpoint groups counters under `stats` or returns flat fields
  sends?: number
  delivered?: number
  deliveries?: number
  opens?: number
  uniqueOpens?: number
  clicks?: number
  uniqueClicks?: number
  unsubscribes?: number
  bounces?: number
  complaints?: number
  // Some responses nest under a `stats` object — handle both shapes in client.
  stats?: {
    sends?: number
    delivered?: number
    deliveries?: number
    opens?: number
    uniqueOpens?: number
    clicks?: number
    uniqueClicks?: number
    unsubscribes?: number
    bounces?: number
  }
}

export interface GHLListResponse<T> {
  campaigns?: T[]
  data?: T[]
  results?: T[]
  // GHL paginates with `meta.nextPage` or a cursor — handle both.
  meta?: { total?: number; nextPage?: string | number | null; nextPageUrl?: string | null }
  nextPage?: string | number | null
}
