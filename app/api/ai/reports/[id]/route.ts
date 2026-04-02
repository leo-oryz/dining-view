import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ai_analysis_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return apiError(error.message, 500)
    if (!data) return apiError('Report not found', 404)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
