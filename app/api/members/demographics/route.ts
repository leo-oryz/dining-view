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
      .select('male_count, female_count, age_0_18, age_19_25, age_26_30, age_31_35, age_36_40, age_41_50, age_51_60, age_60_plus, channel_direct, channel_app, channel_coupon, channel_other')
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
        { label: '19-25', count: data.age_19_25 || 0 },
        { label: '26-30', count: data.age_26_30 || 0 },
        { label: '31-35', count: data.age_31_35 || 0 },
        { label: '36-40', count: data.age_36_40 || 0 },
        { label: '41-50', count: data.age_41_50 || 0 },
        { label: '51-60', count: data.age_51_60 || 0 },
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
