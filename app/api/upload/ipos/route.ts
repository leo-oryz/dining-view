// POST /api/upload/ipos — preview an iPOS upload (parses files, returns summary, no DB writes).

import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { parseIposUpload } from '@/lib/parsers/ipos'

export const runtime = 'nodejs'
export const maxDuration = 60

async function readBuffer(file: File | null): Promise<ArrayBuffer | undefined> {
  if (!file) return undefined
  return await file.arrayBuffer()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const storeId = (formData.get('store_id') as string) || DEFAULT_STORE_ID

    const sale_summary    = await readBuffer(formData.get('sale_summary')    as File | null)
    const payment_methods = await readBuffer(formData.get('payment_methods') as File | null)
    const items           = await readBuffer(formData.get('items')           as File | null)
    const source          = await readBuffer(formData.get('source')          as File | null)

    const required: string[] = []
    if (!sale_summary)    required.push('sale_summary_report.xlsx')
    if (!payment_methods) required.push('payment_methods_report.xlsx')
    if (!items)           required.push('items_report.xlsx')
    if (required.length > 0) {
      return apiError(`Missing required files: ${required.join(', ')}`, 400)
    }

    const parsed = parseIposUpload({ sale_summary, payment_methods, items, source })

    const warnings: string[] = []
    for (const r of [parsed.daily, parsed.hourly, parsed.payments, parsed.products, parsed.source]) {
      if (r.warnings) warnings.push(...r.warnings)
    }

    // Cross-check: payment totals vs daily net_revenue (warn only — payment is gross).
    const paymentTotalByDate = new Map(
      parsed.payments.rows.map(p => [
        p.date,
        p.visa_amount + p.transfer_amount + p.deposit_amount + p.cash_amount,
      ]),
    )

    return apiSuccess({
      storeId,
      detectedDateRange: parsed.detectedDateRange,
      counts: {
        daily: parsed.daily.rows.length,
        hourly: parsed.hourly.rows.length,
        payments: parsed.payments.rows.length,
        products: parsed.products.rows.length,
        source: parsed.source.rows.length,
      },
      sampleDaily: parsed.daily.rows.slice(0, 5),
      sampleHourly: parsed.hourly.rows.slice(0, 5),
      sampleProducts: parsed.products.rows.slice(0, 5),
      paymentTotalByDate: Array.from(paymentTotalByDate.entries()).map(([date, total]) => ({ date, total })),
      errors: parsed.errors,
      warnings,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error parsing iPOS upload'
    return apiError(msg, 500)
  }
}
