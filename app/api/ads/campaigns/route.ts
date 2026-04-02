import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: false })
      .limit(50)

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      date, platform, campaign_name,
      impressions, clicks, spend, conversions,
      store_id,
    } = body

    if (!date || !platform || !campaign_name) {
      return apiError('date, platform, and campaign_name are required', 400)
    }

    const supabase = createServiceClient()

    // Calculate derived fields
    const ctr = impressions && clicks ? clicks / impressions : null
    const cpc = clicks && spend ? spend / clicks : null

    const { data, error } = await supabase
      .from('ad_campaigns')
      .upsert(
        {
          store_id: store_id || DEFAULT_STORE_ID,
          date,
          platform,
          campaign_name,
          impressions: impressions ?? null,
          clicks: clicks ?? null,
          spend: spend ?? null,
          conversions: conversions ?? null,
          ctr,
          cpc,
          roas: null,
        },
        { onConflict: 'store_id,date,platform,campaign_name' }
      )
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
