import { apiSuccess, apiError } from '@/lib/api-utils'
import { sendWeeklyAiReport } from '@/lib/digest/weeklyAiReport'

export const maxDuration = 300

export async function POST(request: Request) {
  // Validate cron secret
  const secret = request.headers.get('x-cron-secret')
    || new URL(request.url).searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const result = await sendWeeklyAiReport()

    if (result.error) {
      return apiError(result.error, 500)
    }

    return apiSuccess({
      message: 'Weekly AI report sent',
      recipient_count: result.recipientCount,
      reports_generated: result.reportsGenerated,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return apiError(message, 500)
  }
}
