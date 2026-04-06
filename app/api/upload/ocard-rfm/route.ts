import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseOcardRFM } from '@/lib/parsers/ocardRFM'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID
    const text = await file.text()
    const { data, errors } = parseOcardRFM(text)

    const snapshotDate = new Date().toISOString().split('T')[0]

    const supabase = createServiceClient()

    const { error: dbError } = await supabase
      .from('ocard_rfm_snapshots')
      .upsert({
        store_id: storeId,
        snapshot_date: snapshotDate,
        period_start: data.period_start,
        period_end: data.period_end,
        total_customers: data.total_customers,
        avg_ticket: data.avg_ticket,
        total_contribution: data.total_contribution,
        avg_days_since_visit: data.avg_days_since_visit,
        gold_count: data.gold_count,
        regular_count: data.regular_count,
        dormant_count: data.dormant_count,
        r_distribution: data.r_distribution,
        f_distribution: data.f_distribution,
        m_distribution: data.m_distribution,
      }, { onConflict: 'store_id,snapshot_date' })

    if (dbError) return apiError(dbError.message, 500)

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'ocard-rfm',
      record_count: 1,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: 1, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
