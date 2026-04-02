import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const reportType = searchParams.get('report_type')
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50)

    const supabase = createServiceClient()

    let query = supabase
      .from('ai_analysis_reports')
      .select('id, report_type, report_date, period_start, period_end, model_used, created_at')
      .eq('store_id', storeId)
      .order('report_date', { ascending: false })
      .limit(limit)

    if (reportType) {
      query = query.eq('report_type', reportType)
    }

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
