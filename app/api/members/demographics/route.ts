import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    // Get latest member snapshot with demographic data
    const { data, error } = await supabase
      .from('ocard_member_snapshots')
      .select('male_count, female_count, age_0_18, age_19_22, age_23_29, age_30_39, age_40_49, age_50_59, age_60_plus, channel_direct, channel_app, channel_coupon, channel_other')
      .eq('store_id', storeId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // No data is OK — return null demographics
      return apiSuccess(null)
    }

    const totalGender = (data.male_count || 0) + (data.female_count || 0)

    const result = {
      gender: {
        male: data.male_count || 0,
        female: data.female_count || 0,
        unknown: Math.max(0, totalGender === 0 ? 0 : 0),
      },
      age: [
        { label: '0-18', count: data.age_0_18 || 0 },
        { label: '19-22', count: data.age_19_22 || 0 },
        { label: '23-29', count: data.age_23_29 || 0 },
        { label: '30-39', count: data.age_30_39 || 0 },
        { label: '40-49', count: data.age_40_49 || 0 },
        { label: '50-59', count: data.age_50_59 || 0 },
        { label: '60+', count: data.age_60_plus || 0 },
      ],
      channels: {
        direct: data.channel_direct || 0,
        app: data.channel_app || 0,
        coupon: data.channel_coupon || 0,
        other: data.channel_other || 0,
      },
    }

    return apiSuccess(result)
  } catch {
    return apiError('Internal server error', 500)
  }
}
