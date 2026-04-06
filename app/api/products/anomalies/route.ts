import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { detectProductAnomalies } from '@/lib/products/anomalyDetector'
import { format, subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const storeId = getStoreId(params)
    const from = params.get('from') || format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const to = params.get('to') || format(new Date(), 'yyyy-MM-dd')
    const type = (params.get('type') || 'all') as 'spike' | 'drop' | 'all'

    if (!['spike', 'drop', 'all'].includes(type)) {
      return apiError('Invalid type parameter. Must be spike, drop, or all.')
    }

    const supabase = createServiceClient()
    const anomalies = await detectProductAnomalies(supabase, storeId, from, to, type)

    return apiSuccess({
      anomalies,
      summary: {
        total: anomalies.length,
        spikes: anomalies.filter(a => a.anomaly_type === 'spike').length,
        drops: anomalies.filter(a => a.anomaly_type === 'drop').length,
        most_anomalous: getMostAnomalousProduct(anomalies),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return apiError(msg, 500)
  }
}

function getMostAnomalousProduct(anomalies: Array<{ product_name: string }>): string | null {
  if (anomalies.length === 0) return null
  const counts: Record<string, number> = {}
  for (const a of anomalies) {
    counts[a.product_name] = (counts[a.product_name] || 0) + 1
  }
  let max = 0
  let maxProduct: string | null = null
  for (const name of Object.keys(counts)) {
    if (counts[name] > max) {
      max = counts[name]
      maxProduct = name
    }
  }
  return maxProduct
}
