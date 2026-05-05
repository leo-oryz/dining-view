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
      .from('daily_sales')
      .select('date, revenue, net_sales, guests, orders, avg_spending, table_turnover_rate, new_members')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (error) return apiError(error.message, 500)

    // Also fetch weather for same period
    const { data: weather } = await supabase
      .from('weather_daily')
      .select('date, description')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)

    const weatherMap = new Map<string, string>()
    if (weather) {
      for (const w of weather) {
        weatherMap.set(w.date, w.description || '')
      }
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Daily Sales')

    sheet.columns = [
      { header: '日期', key: 'date', width: 14 },
      { header: '營收', key: 'revenue', width: 14 },
      { header: '淨銷售額', key: 'net_sales', width: 14 },
      { header: '來客數', key: 'guests', width: 10 },
      { header: '訂單數', key: 'orders', width: 10 },
      { header: '平均客單價', key: 'avg_spending', width: 14 },
      { header: '翻桌率', key: 'turnover', width: 10 },
      { header: '新會員', key: 'new_members', width: 10 },
      { header: '天氣', key: 'weather', width: 16 },
    ]

    // Style header
    sheet.getRow(1).font = { bold: true }

    for (const row of data || []) {
      sheet.addRow({
        date: row.date,
        revenue: row.revenue,
        net_sales: row.net_sales,
        guests: row.guests,
        orders: row.orders,
        avg_spending: row.avg_spending,
        turnover: row.table_turnover_rate,
        new_members: row.new_members,
        weather: weatherMap.get(row.date) || '',
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `diningview-daily-sales-${from}-${to}.xlsx`
    return excelResponse(Buffer.from(buffer), filename)
  } catch {
    return apiError('Internal server error', 500)
  }
}
