import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { prepareAnalysisContext } from '@/lib/ai/dataPrep'
import { getTopProductPairs } from '@/lib/ai/basketAnalysis'
import { getMarginMatrix } from '@/lib/ai/marginMatrix'
import { analyzeWithClaude } from '@/lib/ai/claudeAnalyzer'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id, period_start, period_end } = body

    const storeId = store_id || DEFAULT_STORE_ID

    // Default period: last 90 days for expansion (broader view)
    const end = period_end || new Date().toISOString().slice(0, 10)
    const startDate = new Date(end)
    startDate.setDate(startDate.getDate() - 90)
    const start = period_start || startDate.toISOString().slice(0, 10)

    const supabase = createServiceClient()

    const [context, basketResult, marginMatrix] = await Promise.all([
      prepareAnalysisContext(supabase, storeId, start, end),
      getTopProductPairs(supabase, storeId),
      getMarginMatrix(supabase, storeId, start, end),
    ])

    const reportJson = await analyzeWithClaude(
      'expansion',
      context,
      basketResult.pairs,
      marginMatrix
    )

    // Save to ai_analysis_reports
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('ai_analysis_reports')
      .upsert(
        {
          store_id: storeId,
          report_type: 'expansion',
          report_date: today,
          period_start: start,
          period_end: end,
          content: reportJson,
          model_used: 'claude-sonnet-4-6',
        },
        { onConflict: 'store_id,report_type,report_date' }
      )
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return apiError(message, 500)
  }
}
