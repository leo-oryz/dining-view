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
      .from('order_items')
      .select('date, time, order_number, order_type, order_total, item_name')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (error) return apiError(error.message, 500)

    // Aggregate by order
    const orderMap = new Map<string, {
      order_number: string
      date: string
      time: string | null
      order_type: string | null
      order_total: number | null
      item_count: number
    }>()

    for (const row of data || []) {
      const key = `${row.date}_${row.order_number}`
      if (!orderMap.has(key)) {
        orderMap.set(key, {
          order_number: row.order_number || '',
          date: row.date,
          time: row.time ? new Date(row.time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : null,
          order_type: row.order_type,
          order_total: row.order_total,
          item_count: 1,
        })
      } else {
        orderMap.get(key)!.item_count++
      }
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Orders')

    sheet.columns = [
      { header: '訂單編號', key: 'order_number', width: 18 },
      { header: '日期', key: 'date', width: 14 },
      { header: '時間', key: 'time', width: 10 },
      { header: '類型', key: 'order_type', width: 12 },
      { header: '金額', key: 'order_total', width: 14 },
      { header: '品項數', key: 'item_count', width: 10 },
    ]

    sheet.getRow(1).font = { bold: true }

    for (const order of Array.from(orderMap.values())) {
      sheet.addRow({
        order_number: order.order_number,
        date: order.date,
        time: order.time || '',
        order_type: order.order_type || '',
        order_total: order.order_total,
        item_count: order.item_count,
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `fnb-pulse-orders-${from}-${to}.xlsx`
    return excelResponse(Buffer.from(buffer), filename)
  } catch {
    return apiError('Internal server error', 500)
  }
}
