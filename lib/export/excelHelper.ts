import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-utils'

export function parseExportParams(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id') || '00000000-0000-0000-0000-000000000001'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return { error: apiError('from and to date params required (YYYY-MM-DD)', 400) }
  }

  // Validate date range max 366 days
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)

  if (diffDays > 366) {
    return { error: apiError('Date range cannot exceed 366 days', 400) }
  }

  if (diffDays < 0) {
    return { error: apiError('from date must be before to date', 400) }
  }

  return { storeId, from, to }
}

export function excelResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
