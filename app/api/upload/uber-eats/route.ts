import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseUberEatsCsv } from '@/lib/parsers/uberEats'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID
    const csvText = await file.text()
    const { data, errors } = parseUberEatsCsv(csvText)

    if (data.length === 0) {
      return apiError('No valid data rows found', 400)
    }

    const supabase = createServiceClient()

    const rows = data.map(row => ({
      store_id: storeId,
      revenue: row.gross_revenue,
      ...row,
    }))

    const { error: dbError } = await supabase
      .from('delivery_sales')
      .upsert(rows, { onConflict: 'store_id,date,platform' })

    if (dbError) return apiError(dbError.message, 500)

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'uber-eats',
      record_count: data.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: data.length, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
