import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { createHmac } from 'crypto'

function generateShareToken(reportId: string): string {
  const secret = process.env.CRON_SECRET || 'fallback-secret'
  return createHmac('sha256', secret).update(reportId).digest('hex').slice(0, 24)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Verify report exists
    const { data, error } = await supabase
      .from('ai_analysis_reports')
      .select('id')
      .eq('id', id)
      .single()

    if (error || !data) return apiError('Report not found', 404)

    const token = generateShareToken(id)

    return apiSuccess({ share_token: `${id}-${token}` })
  } catch {
    return apiError('Internal server error', 500)
  }
}
