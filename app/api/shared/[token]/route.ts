import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ai_analysis_reports')
      .select('id, report_type, report_date, period_start, period_end, content, model_used, created_at, store_id')
      .eq('share_token', token)
      .single()

    if (error || !data) return apiError('Report not found', 404)

    // Fetch store name for display
    const { data: store } = await supabase
      .from('stores')
      .select('name')
      .eq('id', data.store_id)
      .single()

    return apiSuccess({
      ...data,
      store_name: store?.name || null,
      store_id: undefined, // Don't expose store_id publicly
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
