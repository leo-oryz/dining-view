const META_API_VERSION = 'v18.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

interface MetaCampaignInsight {
  campaign_id: string
  campaign_name: string
  date_start: string
  spend: string
  impressions: string
  reach: string
  clicks: string
  ctr: string
  conversions: number
  cpa: string
  purchase_roas: string
}

export interface MetaCampaignRow {
  date: string
  platform: 'meta'
  campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  conversions: number
  cpa: number
  roas: number
  data_source: 'meta_api'
}

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res

    const body = await res.json().catch(() => ({}))
    const errorCode = body?.error?.code

    // Rate limit or transient error — retry with backoff
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)))
      continue
    }

    // Auth error — do not retry
    if (errorCode === 190 || errorCode === 200) {
      throw new Error(`Meta API auth error: ${body?.error?.message || res.statusText}`)
    }

    throw new Error(`Meta API error (${res.status}): ${body?.error?.message || res.statusText}`)
  }
  throw new Error('Meta API: max retries exceeded')
}

import type { CredentialsSchema } from '@/lib/integrations/credentials'

export async function fetchMetaCampaigns(
  creds: CredentialsSchema['meta_ads'],
  date: string,
): Promise<MetaCampaignRow[]> {
  const { access_token, account_id } = creds

  const fields = 'campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,actions,cost_per_action_type,purchase_roas'
  const url = `${META_BASE_URL}/${account_id}/insights?fields=${fields}&time_range={"since":"${date}","until":"${date}"}&level=campaign&access_token=${access_token}`

  const res = await fetchWithRetry(url)
  const json = await res.json()

  if (!json.data || !Array.isArray(json.data)) {
    return []
  }

  // Deduplicate by campaign_id
  const seen = new Set<string>()
  const rows: MetaCampaignRow[] = []

  for (const insight of json.data as MetaCampaignInsight[]) {
    if (seen.has(insight.campaign_id)) continue
    seen.add(insight.campaign_id)

    // Extract conversions from actions array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = (insight as any).actions as Array<{ action_type: string; value: string }> | undefined
    const purchaseAction = actions?.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
    const conversions = purchaseAction ? Number(purchaseAction.value) || 0 : 0

    // Extract CPA from cost_per_action_type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const costPerAction = (insight as any).cost_per_action_type as Array<{ action_type: string; value: string }> | undefined
    const cpaPurchase = costPerAction?.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
    const cpa = cpaPurchase ? Number(cpaPurchase.value) || 0 : 0

    // Extract ROAS from purchase_roas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roasArr = (insight as any).purchase_roas as Array<{ action_type: string; value: string }> | undefined
    const roasEntry = roasArr?.find(a => a.action_type === 'omni_purchase')
    const roas = roasEntry ? Number(roasEntry.value) || 0 : 0

    rows.push({
      date,
      platform: 'meta',
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      spend: Number(insight.spend) || 0,
      impressions: Number(insight.impressions) || 0,
      reach: Number(insight.reach) || 0,
      clicks: Number(insight.clicks) || 0,
      ctr: Number(insight.ctr) || 0,
      conversions,
      cpa,
      roas,
      data_source: 'meta_api',
    })
  }

  return rows
}
