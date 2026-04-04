import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseOcardRecruit } from '@/lib/parsers/ocardRecruitTrend'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID
    const text = await file.text()
    const { data, errors } = parseOcardRecruit(text)

    const snapshotDate = new Date().toISOString().split('T')[0]

    const supabase = createServiceClient()

    const { error: dbError } = await supabase
      .from('ocard_member_snapshots')
      .upsert({
        store_id: storeId,
        snapshot_date: snapshotDate,
        period_start: data.period_start,
        period_end: data.period_end,
        total_members: data.total_members,
        new_members: data.new_members,
        conversion_rate: data.conversion_rate,
        male_count: data.male_count,
        female_count: data.female_count,
        age_0_18: data.age_0_18,
        age_19_22: data.age_19_22,
        age_23_29: data.age_23_29,
        age_30_39: data.age_30_39,
        age_40_49: data.age_40_49,
        age_50_59: data.age_50_59,
        age_60_plus: data.age_60_plus,
        channel_direct: data.channel_direct,
        channel_app: data.channel_app,
        channel_coupon: data.channel_coupon,
        channel_other: data.channel_other,
      }, { onConflict: 'store_id,snapshot_date' })

    if (dbError) return apiError(dbError.message, 500)

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'ocard-recruit',
      record_count: 1,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: 1, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
