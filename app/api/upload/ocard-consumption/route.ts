import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseOcardConsumption } from '@/lib/parsers/ocardConsumption'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID
    const text = await file.text()
    const { data, errors } = parseOcardConsumption(text)

    const snapshotDate = new Date().toISOString().split('T')[0]

    const supabase = createServiceClient()

    // Merge consumption data into existing snapshot (recruit data may already be there)
    const { error: dbError } = await supabase
      .from('ocard_member_snapshots')
      .upsert({
        store_id: storeId,
        snapshot_date: snapshotDate,
        period_start: data.period_start,
        period_end: data.period_end,
        spending_total: data.spending_total,
        spending_customers: data.spending_customers,
        spending_transactions: data.spending_transactions,
        avg_ticket: data.avg_ticket,
        avg_frequency: data.avg_frequency,
        vip_tier_1_count: data.vip_tier_1_count,
        vip_tier_2_count: data.vip_tier_2_count,
        vip_tier_3_count: data.vip_tier_3_count,
      }, { onConflict: 'store_id,snapshot_date' })

    if (dbError) return apiError(dbError.message, 500)

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'ocard-consumption',
      record_count: 1,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: 1, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
