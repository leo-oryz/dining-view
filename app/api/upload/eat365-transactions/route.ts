import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseEat365Transactions } from '@/lib/parsers/eat365Transactions'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID
    const text = await file.text()
    const { data, errors } = parseEat365Transactions(text)

    if (data.length === 0) {
      return apiError('No valid data rows found', 400)
    }

    const supabase = createServiceClient()

    // Batch upsert in chunks of 500
    const chunkSize = 500
    let totalImported = 0

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize).map(row => ({
        store_id: storeId,
        date: row.date,
        order_number: row.order_number,
        order_type: row.order_type,
        time: row.time,
        tender: row.tender,
        guest_count: row.guest_count,
        subtotal: row.subtotal,
        discount: row.discount,
        order_total: row.order_total,
        item_name: row.item_name,
        item_type: row.item_type,
        product_type: row.product_type,
        item_amount: row.item_amount,
        item_quantity: row.item_quantity,
        cost: row.cost,
        modifier_name: row.modifier_name,
        modifier_value: row.modifier_value,
        source: 'eat365',
      }))

      const { error: dbError } = await supabase
        .from('order_items')
        .upsert(chunk, { onConflict: 'store_id,order_number,item_name,COALESCE(modifier_name, \'\')' })

      if (dbError) return apiError(dbError.message, 500)
      totalImported += chunk.length
    }

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'eat365-transactions',
      record_count: totalImported,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: totalImported, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
