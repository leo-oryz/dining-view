import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseEat365DailyClosing, type DailyClosingReportJSON } from '@/lib/parsers/eat365DailyClosing'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

interface UploadBody {
  store_id?: string
  date: string
  json: DailyClosingReportJSON
}

export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get('content-type') || ''
    let storeId: string = DEFAULT_STORE_ID
    let date: string
    let json: DailyClosingReportJSON

    if (ct.includes('application/json')) {
      const body = (await request.json()) as UploadBody
      if (!body.date || !body.json) return apiError('date and json required', 400)
      storeId = body.store_id || DEFAULT_STORE_ID
      date = body.date
      json = body.json
    } else {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) return apiError('No file or json provided', 400)
      const text = await file.text()
      const parsed = JSON.parse(text) as { date?: string; json?: DailyClosingReportJSON } & DailyClosingReportJSON
      // Accept either { date, json: {...} } wrapper or raw JSON with a date field
      if (parsed.date && parsed.json) {
        date = parsed.date
        json = parsed.json
      } else if (parsed.startDate) {
        date = String(parsed.startDate).slice(0, 10)
        json = parsed as DailyClosingReportJSON
      } else {
        return apiError('Could not determine date from payload', 400)
      }
      const formStore = formData.get('store_id')
      if (typeof formStore === 'string') storeId = formStore
    }

    const { data: rows, errors } = parseEat365DailyClosing(json, date)
    if (rows.length === 0) {
      return apiError('No daily closing data extracted from payload', 400)
    }

    const supabase = createServiceClient()

    // Replace any existing daily-closing rows for this date so re-uploads stay
    // idempotent without colliding with real transaction-report data.
    await supabase
      .from('order_items')
      .delete()
      .eq('store_id', storeId)
      .eq('date', date)
      .eq('source', 'eat365-daily-closing')

    const payload = rows.map((r) => ({
      store_id: storeId,
      date: r.date,
      order_number: r.order_number,
      order_type: r.order_type,
      time: r.time,
      guest_count: r.guest_count,
      item_name: r.item_name,
      item_amount: r.item_amount,
      item_quantity: r.item_quantity,
      modifier_name: '',
      source: 'eat365-daily-closing',
    }))

    const { error: dbError } = await supabase
      .from('order_items')
      .upsert(payload, {
        onConflict: 'store_id,order_number,item_name,modifier_name',
        ignoreDuplicates: false,
      })

    if (dbError) return apiError(dbError.message, 500)

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: `daily_closing_${date}.json`,
      file_type: 'eat365-daily-closing',
      record_count: payload.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: payload.length, date, errors })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal server error', 500)
  }
}
