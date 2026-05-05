import { createServiceClient } from '@/lib/supabase/server'
import {
  fetchCampaigns,
  fetchCampaignStats,
  isGHLConfigured,
  type GHLConfig,
} from './client'
import { transformCampaign } from './transformer'
import { runAttribution } from './attribution'

const SETTING_KEY_API = 'ghl_api_key'

async function loadStoreConfig(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
): Promise<GHLConfig> {
  const { data } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .eq('setting_key', SETTING_KEY_API)
    .maybeSingle()
  if (data?.setting_value) return { apiKey: data.setting_value as string }
  return {}
}

export interface GHLSyncResult {
  store: string
  store_id: string
  campaigns?: number
  attribution_matches?: number
  skipped?: boolean
  error?: string
}

export async function syncGHL(options?: {
  storeId?: string
  config?: GHLConfig
}): Promise<GHLSyncResult[]> {
  const supabase = createServiceClient()

  let storesQuery = supabase.from('stores').select('id, name')
  if (options?.storeId) storesQuery = storesQuery.eq('id', options.storeId)
  const { data: stores, error: storesErr } = await storesQuery
  if (storesErr) throw storesErr
  if (!stores?.length) return []

  const results: GHLSyncResult[] = []

  for (const store of stores) {
    const storeId = store.id as string
    const result: GHLSyncResult = { store: store.name, store_id: storeId }

    const cfg = options?.config ?? (await loadStoreConfig(supabase, storeId))
    if (!isGHLConfigured(cfg)) {
      result.skipped = true
      results.push(result)
      continue
    }

    try {
      const campaigns = await fetchCampaigns(cfg)
      const rows = []
      for (const campaign of campaigns) {
        const stats = await fetchCampaignStats(String(campaign.id), cfg)
        rows.push(transformCampaign(campaign, stats, storeId))
      }
      if (rows.length) {
        const { error } = await supabase
          .from('email_campaigns')
          .upsert(rows, { onConflict: 'store_id,ghl_campaign_id', ignoreDuplicates: false })
        if (error) throw error
      }
      result.campaigns = rows.length

      const attribution = await runAttribution(supabase, storeId)
      result.attribution_matches = attribution.matched
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err)
    }

    results.push(result)
  }

  return results
}
