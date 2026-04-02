const TIKTOK_API_VERSION = 'v1.3'
const TIKTOK_BASE_URL = `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}`

export interface TikTokCampaignRow {
  date: string
  platform: 'tiktok'
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
  data_source: 'tiktok_api'
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3, delayMs = 1000): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers })
    if (res.ok) return res

    const body = await res.json().catch(() => ({}))

    // Rate limit or transient error — retry with backoff
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)))
      continue
    }

    // Auth error — do not retry
    if (body?.code === 40001 || body?.code === 40100) {
      throw new Error(`TikTok API auth error: ${body?.message || res.statusText}`)
    }

    throw new Error(`TikTok API error (${res.status}): ${body?.message || res.statusText}`)
  }
  throw new Error('TikTok API: max retries exceeded')
}

export async function fetchTikTokCampaigns(date: string): Promise<TikTokCampaignRow[]> {
  const accessToken = process.env.TIKTOK_ADS_ACCESS_TOKEN
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID

  if (!accessToken || !advertiserId) {
    throw new Error('Missing TIKTOK_ADS_ACCESS_TOKEN or TIKTOK_ADS_ADVERTISER_ID env vars')
  }

  const headers = {
    'Access-Token': accessToken,
    'Content-Type': 'application/json',
  }

  // Fetch campaign list
  const campaignUrl = `${TIKTOK_BASE_URL}/campaign/get/?advertiser_id=${advertiserId}&page_size=100`
  const campaignRes = await fetchWithRetry(campaignUrl, headers)
  const campaignJson = await campaignRes.json()

  if (campaignJson.code !== 0 || !campaignJson.data?.list) {
    if (campaignJson.data?.list?.length === 0) return []
    throw new Error(`TikTok campaign list error: ${campaignJson.message}`)
  }

  const campaignMap = new Map<string, string>()
  for (const c of campaignJson.data.list) {
    campaignMap.set(String(c.campaign_id), c.campaign_name)
  }

  if (campaignMap.size === 0) return []

  // Fetch insights for the date
  const campaignIds = Array.from(campaignMap.keys())
  const metricsFields = JSON.stringify([
    'spend', 'impressions', 'reach', 'clicks', 'ctr',
    'conversion', 'cost_per_conversion', 'complete_payment_roas',
  ])
  const filtering = JSON.stringify({ campaign_ids: campaignIds })

  const reportUrl = `${TIKTOK_BASE_URL}/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&dimensions=["campaign_id"]&data_level=AUCTION_CAMPAIGN&start_date=${date}&end_date=${date}&metrics=${encodeURIComponent(metricsFields)}&filtering=${encodeURIComponent(filtering)}&page_size=100`

  const reportRes = await fetchWithRetry(reportUrl, headers)
  const reportJson = await reportRes.json()

  if (reportJson.code !== 0) {
    if (reportJson.data?.list?.length === 0) return []
    throw new Error(`TikTok report error: ${reportJson.message}`)
  }

  const rows: TikTokCampaignRow[] = []
  const seen = new Set<string>()

  for (const item of reportJson.data?.list || []) {
    const campaignId = String(item.dimensions?.campaign_id)
    if (seen.has(campaignId)) continue
    seen.add(campaignId)

    const metrics = item.metrics || {}
    const campaignName = campaignMap.get(campaignId) || `Campaign ${campaignId}`

    rows.push({
      date,
      platform: 'tiktok',
      campaign_id: campaignId,
      campaign_name: campaignName,
      spend: Number(metrics.spend) || 0,
      impressions: Number(metrics.impressions) || 0,
      reach: Number(metrics.reach) || 0,
      clicks: Number(metrics.clicks) || 0,
      ctr: Number(metrics.ctr) || 0,
      conversions: Number(metrics.conversion) || 0,
      cpa: Number(metrics.cost_per_conversion) || 0,
      roas: Number(metrics.complete_payment_roas) || 0,
      data_source: 'tiktok_api',
    })
  }

  return rows
}
