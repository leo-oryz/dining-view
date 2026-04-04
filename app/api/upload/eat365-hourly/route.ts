import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseEat365Hourly } from '@/lib/parsers/eat365Hourly'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID

    // Accept explicit date from form data (agent upload), or extract from filename
    const formDate = formData.get('date') as string | null
    const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})\d{4}-/)
    const agentDateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/)
    const date = formDate
      || (dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null)
      || (agentDateMatch ? agentDateMatch[1] : null)
      || new Date().toISOString().split('T')[0]

    const buffer = await file.arrayBuffer()
    const { data, errors } = parseEat365Hourly(buffer)

    if (data.length === 0) {
      return apiError('No valid data rows found', 400)
    }

    const supabase = createServiceClient()

    const rows = data.map(row => ({
      store_id: storeId,
      date,
      ...row,
    }))

    const { error: dbError } = await supabase
      .from('hourly_sales')
      .upsert(rows, { onConflict: 'store_id,date,hour' })

    if (dbError) return apiError(dbError.message, 500)

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'eat365-hourly',
      record_count: data.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: data.length, date, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
