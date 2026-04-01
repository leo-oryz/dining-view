import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseOcardDashboard } from '@/lib/parsers/ocardDashboard'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID
    const buffer = await file.arrayBuffer()
    const { data, errors } = parseOcardDashboard(buffer)

    if (data.length === 0) {
      return apiError('No valid data rows found', 400)
    }

    const supabase = createServiceClient()

    // Upsert member fields into daily_sales (merge with existing eat365 data)
    for (const row of data) {
      const { error: dbError } = await supabase
        .from('daily_sales')
        .upsert({
          store_id: storeId,
          date: row.date,
          member_visits: row.member_visits,
          new_members: row.new_members,
          regular_members: row.regular_members,
          total_members: row.total_members,
          invited_members: row.invited_members,
          new_reachable_members: row.new_reachable_members,
        }, { onConflict: 'store_id,date' })

      if (dbError) return apiError(dbError.message, 500)
    }

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'ocard-dashboard',
      record_count: data.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: data.length, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
