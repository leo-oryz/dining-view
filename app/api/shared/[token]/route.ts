import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { createHmac } from 'crypto'

function verifyShareToken(token: string): string | null {
  // Token format: {reportId}-{hmac} where hmac is 24 hex chars
  if (token.length < 26) return null

  const hmacPart = token.slice(-24)
  const reportId = token.slice(0, -(24 + 1)) // remove "-" + hmac

  const secret = process.env.CRON_SECRET || 'fallback-secret'
  const expected = createHmac('sha256', secret).update(reportId).digest('hex').slice(0, 24)

  if (hmacPart !== expected) return null
  return reportId
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const reportId = verifyShareToken(token)

    if (!reportId) return apiError('Invalid or expired share link', 403)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ai_analysis_reports')
      .select('id, report_type, report_date, period_start, period_end, content, model_used, created_at, store_id')
      .eq('id', reportId)
      .single()

    if (error || !data) return apiError('Report not found', 404)

    // Fetch store name for display
    const { data: store } = await supabase
      .from('stores')
      .select('name')
      .eq('id', data.store_id)
      .single()

    // Don't expose store_id publicly
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { store_id: _storeId, ...publicData } = data

    return apiSuccess({
      ...publicData,
      store_name: store?.name || null,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
