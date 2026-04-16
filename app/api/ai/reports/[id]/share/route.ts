import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { randomBytes } from 'crypto'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Check if report exists and already has a share token
    const { data: report, error: fetchErr } = await supabase
      .from('ai_analysis_reports')
      .select('id, share_token')
      .eq('id', id)
      .single()

    if (fetchErr || !report) return apiError('Report not found', 404)

    // If already shared, return existing token
    if (report.share_token) {
      return apiSuccess({ share_token: report.share_token })
    }

    // Generate a URL-safe token
    const token = randomBytes(16).toString('hex')

    const { error: updateErr } = await supabase
      .from('ai_analysis_reports')
      .update({ share_token: token })
      .eq('id', id)

    if (updateErr) return apiError(updateErr.message, 500)

    return apiSuccess({ share_token: token })
  } catch {
    return apiError('Internal server error', 500)
  }
}

// DELETE to revoke sharing
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('ai_analysis_reports')
      .update({ share_token: null })
      .eq('id', id)

    if (error) return apiError(error.message, 500)

    return apiSuccess({ revoked: true })
  } catch {
    return apiError('Internal server error', 500)
  }
}
