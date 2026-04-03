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
      .from('ocard_member_snapshots')
      .select('snapshot_date, total_members, new_members, conversion_rate, vip_tier_1_count, vip_tier_2_count, vip_tier_3_count')
      .eq('store_id', storeId)
      .gte('snapshot_date', from)
      .lte('snapshot_date', to)
      .order('snapshot_date', { ascending: true })

    if (error) return apiError(error.message, 500)

    // Also get daily_sales for returning ratio
    const { data: dailySales } = await supabase
      .from('daily_sales')
      .select('date, total_members, new_members, regular_members')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    const dailyMap = new Map<string, { total_members: number | null; new_members: number | null; regular_members: number | null }>()
    if (dailySales) {
      for (const d of dailySales) {
        dailyMap.set(d.date, d)
      }
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Members')

    sheet.columns = [
      { header: '日期', key: 'date', width: 14 },
      { header: '總會員數', key: 'total_members', width: 12 },
      { header: '新會員', key: 'new_members', width: 10 },
      { header: '回訪率', key: 'returning_ratio', width: 10 },
      { header: 'VIP Tier 1', key: 'vip1', width: 12 },
      { header: 'VIP Tier 2', key: 'vip2', width: 12 },
      { header: 'VIP Tier 3', key: 'vip3', width: 12 },
    ]

    sheet.getRow(1).font = { bold: true }

    for (const row of data || []) {
      const daily = dailyMap.get(row.snapshot_date)
      const totalMem = row.total_members ?? daily?.total_members
      const newMem = row.new_members ?? daily?.new_members
      const regularMem = daily?.regular_members
      const returningRatio = totalMem && newMem && totalMem > 0
        ? `${(((totalMem - newMem) / totalMem) * 100).toFixed(1)}%`
        : regularMem && totalMem && totalMem > 0
        ? `${((regularMem / totalMem) * 100).toFixed(1)}%`
        : ''

      sheet.addRow({
        date: row.snapshot_date,
        total_members: totalMem,
        new_members: newMem,
        returning_ratio: returningRatio,
        vip1: row.vip_tier_1_count,
        vip2: row.vip_tier_2_count,
        vip3: row.vip_tier_3_count,
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `fnb-pulse-members-${from}-${to}.xlsx`
    return excelResponse(Buffer.from(buffer), filename)
  } catch {
    return apiError('Internal server error', 500)
  }
}
