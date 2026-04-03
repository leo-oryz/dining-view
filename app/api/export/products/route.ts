import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-utils'
import { parseExportParams, excelResponse } from '@/lib/export/excelHelper'

export async function GET(request: NextRequest) {
  try {
    const params = parseExportParams(request)
    if ('error' in params) return params.error

    const { storeId, from, to } = params
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('product_sales')
      .select('date, product_name, category, quantity_sold, revenue, gross_margin')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (error) return apiError(error.message, 500)

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Product Sales')

    sheet.columns = [
      { header: '日期', key: 'date', width: 14 },
      { header: '商品名稱', key: 'product_name', width: 24 },
      { header: '分類', key: 'category', width: 16 },
      { header: '銷量', key: 'quantity_sold', width: 10 },
      { header: '營收', key: 'revenue', width: 14 },
      { header: '毛利率', key: 'gross_margin', width: 10 },
    ]

    sheet.getRow(1).font = { bold: true }

    for (const row of data || []) {
      sheet.addRow({
        date: row.date,
        product_name: row.product_name,
        category: row.category || '',
        quantity_sold: row.quantity_sold,
        revenue: row.revenue,
        gross_margin: row.gross_margin != null ? `${(row.gross_margin * 100).toFixed(1)}%` : '',
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `fnb-pulse-products-${from}-${to}.xlsx`
    return excelResponse(Buffer.from(buffer), filename)
  } catch {
    return apiError('Internal server error', 500)
  }
}
