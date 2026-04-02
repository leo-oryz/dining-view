import { detectAnomalies } from '@/lib/alerts/anomalyDetector'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function POST() {
  try {
    const anomalies = await detectAnomalies()

    return apiSuccess({
      detected: anomalies.length,
      anomalies: anomalies.map(a => ({
        store: a.store_name,
        type: a.alert_type,
        severity: a.severity,
        message: a.message,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
