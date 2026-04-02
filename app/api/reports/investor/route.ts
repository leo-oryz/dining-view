import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvestorReportDocument } from '@/lib/reports/investorPDF'
import type { ReportData } from '@/lib/reports/investorPDF'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import React from 'react'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const storeId = body.store_id || DEFAULT_STORE_ID

    const supabase = createServiceClient()

    // Get store name
    const { data: store } = await supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single()

    const now = new Date()
    const reportMonth = format(now, 'yyyy-MM')

    // Last 12 months of revenue
    const twelveMonthsAgo = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd')
    const endStr = format(endOfMonth(now), 'yyyy-MM-dd')

    const { data: dailySales } = await supabase
      .from('daily_sales')
      .select('date, net_sales, guests, avg_spending, table_turnover_rate, new_members, total_members')
      .eq('store_id', storeId)
      .gte('date', twelveMonthsAgo)
      .lte('date', endStr)
      .order('date', { ascending: true })

    // Aggregate monthly revenue
    const monthlyMap = new Map<string, number>()
    const memberMap = new Map<string, number>()
    let totalGuests = 0
    let totalNewMembers = 0
    let sumSpend = 0
    let sumTurnover = 0
    let spendCount = 0
    let turnoverCount = 0

    for (const row of dailySales || []) {
      const month = String(row.date).substring(0, 7)
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + (Number(row.net_sales) || 0))
      if (row.total_members) memberMap.set(month, Number(row.total_members))
      totalGuests += Number(row.guests) || 0
      totalNewMembers += Number(row.new_members) || 0
      if (row.avg_spending) { sumSpend += Number(row.avg_spending); spendCount++ }
      if (row.table_turnover_rate) { sumTurnover += Number(row.table_turnover_rate); turnoverCount++ }
    }

    const monthly_revenue = Array.from(monthlyMap.entries()).map(([month, revenue]) => ({ month, revenue }))
    const member_growth = Array.from(memberMap.entries()).map(([month, total_members]) => ({ month, total_members }))

    // Top 10 products by revenue (last 3 months)
    const threeMonthsAgo = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd')
    const { data: productData } = await supabase
      .from('product_sales')
      .select('product_name, quantity, total_amount')
      .eq('store_id', storeId)
      .gte('date', threeMonthsAgo)
      .lte('date', endStr)

    // Aggregate by product
    const productMap = new Map<string, { revenue: number; qty: number }>()
    for (const p of productData || []) {
      const existing = productMap.get(p.product_name) || { revenue: 0, qty: 0 }
      existing.revenue += Number(p.total_amount) || 0
      existing.qty += Number(p.quantity) || 0
      productMap.set(p.product_name, existing)
    }

    const top_products = Array.from(productMap.entries())
      .map(([product_name, v]) => ({
        product_name,
        total_revenue: v.revenue,
        total_quantity: v.qty,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)

    // Gross margin from product_costs
    const { data: costData } = await supabase
      .from('product_costs')
      .select('gross_margin')
      .eq('store_id', storeId)

    const margins = (costData || []).map(c => Number(c.gross_margin)).filter(m => !isNaN(m) && m > 0)
    const gross_margin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null

    const reportData: ReportData = {
      store_name: store?.name || 'Unknown Store',
      report_month: reportMonth,
      monthly_revenue,
      member_growth,
      top_products,
      gross_margin,
      kpis: {
        avg_spend: spendCount > 0 ? sumSpend / spendCount : 0,
        turnover_rate: turnoverCount > 0 ? sumTurnover / turnoverCount : 0,
        new_member_rate: totalGuests > 0 ? totalNewMembers / totalGuests : 0,
      },
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(InvestorReportDocument, { data: reportData }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
    )

    const filename = `fnb-pulse-investor-${reportMonth}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
