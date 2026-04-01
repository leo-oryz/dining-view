import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseEat365Items } from '@/lib/parsers/eat365Items'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    const storeId = formData.get('store_id') as string || DEFAULT_STORE_ID

    // Extract date from filename: Sales_By_Item+202603310000-...
    const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})\d{4}-/)
    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      : new Date().toISOString().split('T')[0]

    const buffer = await file.arrayBuffer()
    const { data, errors } = parseEat365Items(buffer)

    if (data.length === 0) {
      return apiError('No valid data rows found', 400)
    }

    const supabase = createServiceClient()

    // Deduplicate by product_name (keep last occurrence)
    const deduped = new Map<string, typeof data[0]>()
    for (const row of data) {
      deduped.set(row.product_name, row)
    }

    // Upsert product_sales
    const salesRows = Array.from(deduped.values()).map(row => ({
      store_id: storeId,
      date,
      product_name: row.product_name,
      category: row.category,
      product_type: row.product_type,
      sub_product_type: row.sub_product_type,
      product_code: row.product_code,
      price: row.price,
      quantity_sold: row.quantity_sold,
      discount_amount: row.discount_amount,
      revenue: row.revenue,
      total_cost: row.total_cost,
      gross_profit: row.gross_profit,
      gross_margin: row.gross_margin,
    }))

    const { error: salesError } = await supabase
      .from('product_sales')
      .upsert(salesRows, { onConflict: 'store_id,date,product_name' })

    if (salesError) return apiError(salesError.message, 500)

    // Upsert product_costs (latest cost data)
    const costRows = Array.from(deduped.values())
      .filter(row => row.total_cost !== null)
      .map(row => ({
        store_id: storeId,
        product_name: row.product_name,
        product_code: row.product_code,
        category: row.category,
        unit_cost: row.total_cost && row.quantity_sold ? row.total_cost / row.quantity_sold : null,
        selling_price: row.price,
        gross_margin: row.gross_margin,
        last_updated: date,
      }))

    if (costRows.length > 0) {
      await supabase
        .from('product_costs')
        .upsert(costRows, { onConflict: 'store_id,product_name' })
    }

    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'eat365-items',
      record_count: data.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({ imported: data.length, date, errors })
  } catch {
    return apiError('Internal server error', 500)
  }
}
