import { apiSuccess, apiError } from '@/lib/api-utils'
import { sendDigest } from '@/lib/digest/weeklyDigest'

export async function POST() {
  try {
    const result = await sendDigest()

    if (result.error) {
      return apiError(result.error, 500)
    }

    return apiSuccess({
      message: 'Weekly digest sent',
      recipient_count: result.recipientCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return apiError(message, 500)
  }
}
