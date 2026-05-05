import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchCampaigns } from '@/lib/integrations/gohighlevel/client'

const KEY_API = 'ghl_api_key'

async function resolveApiKey(body: { store_id?: string; api_key?: string }): Promise<string | undefined> {
  const fromBody = body.api_key?.trim() || undefined
  if (fromBody) return fromBody
  const storeId = body.store_id?.trim()
  if (!storeId) return undefined

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('store_settings')
    .select('setting_value')
    .eq('store_id', storeId)
    .eq('setting_key', KEY_API)
    .limit(1)
  return (data?.[0]?.setting_value as string | null) || undefined
}

async function run(apiKey?: string) {
  try {
    const campaigns = await fetchCampaigns(apiKey ? { apiKey } : undefined)
    return { success: true, detail: `Connection OK — ${campaigns.length} campaigns visible` }
  } catch (err) {
    return { success: false, detail: err instanceof Error ? err.message : 'Test failed' }
  }
}

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const result = await run()
  return apiSuccess(result)
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const body = await request.json().catch(() => ({}))
  const apiKey = await resolveApiKey(body)
  const result = await run(apiKey)
  return apiSuccess(result)
}
