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

    const { data: dailySales } = await supabase
      .from('daily_sales')
      .select('date, total_members, new_members, regular_members')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Members')

    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Total Members', key: 'total_members', width: 14 },
      { header: 'New Members', key: 'new_members', width: 12 },
      { header: 'Returning Members', key: 'regular_members', width: 16 },
    ]

    sheet.getRow(1).font = { bold: true }

    for (const row of dailySales || []) {
      sheet.addRow({
        date: row.date,
        total_members: row.total_members,
        new_members: row.new_members,
        regular_members: row.regular_members,
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `diningview-members-${from}-${to}.xlsx`
    return excelResponse(Buffer.from(buffer), filename)
  } catch {
    return apiError('Internal server error', 500)
  }
}
