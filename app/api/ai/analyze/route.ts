import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { prepareAnalysisContext } from '@/lib/ai/dataPrep'
import { getTopProductPairs } from '@/lib/ai/basketAnalysis'
import { getMarginMatrix } from '@/lib/ai/marginMatrix'
import { analyzeWithClaude } from '@/lib/ai/claudeAnalyzer'

const VALID_TYPES = ['attribution', 'star_products', 'retire_candidates'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      report_type,
      store_id,
      period_start,
      period_end,
    } = body

    if (!report_type || !VALID_TYPES.includes(report_type)) {
      return apiError(`Invalid report_type. Must be one of: ${VALID_TYPES.join(', ')}`, 400)
    }

    const storeId = store_id || DEFAULT_STORE_ID

    // Default period: last 30 days
    const end = period_end || new Date().toISOString().slice(0, 10)
    const startDate = new Date(end)
    startDate.setDate(startDate.getDate() - 30)
    const start = period_start || startDate.toISOString().slice(0, 10)

    const supabase = createServiceClient()

    // Gather data in parallel
    const [context, basketResult, marginMatrix] = await Promise.all([
      prepareAnalysisContext(supabase, storeId, start, end),
      getTopProductPairs(supabase, storeId),
      getMarginMatrix(supabase, storeId, start, end),
    ])

    // Call Claude
    const reportJson = await analyzeWithClaude(
      report_type,
      context,
      basketResult.pairs,
      marginMatrix
    )

    // Save to DB
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('ai_analysis_reports')
      .upsert(
        {
          store_id: storeId,
          report_type,
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
