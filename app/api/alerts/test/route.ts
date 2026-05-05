import { sendAlertEmail } from '@/lib/alerts/emailNotifier'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { APP_TIMEZONE } from '@/lib/constants/timezone'

export async function POST() {
  try {
    const now = new Date().toLocaleString('vi-VN', { timeZone: APP_TIMEZONE })

    const result = await sendAlertEmail([
      {
        severity: 'warning',
        alert_type: 'test',
        message: `這是一則測試警報通知，確認 Email 通知功能正常運作。時間：${now}`,
      },
    ])

    if (!result.success) {
      return apiError(result.error || 'Failed to send test email', 500)
    }

    return apiSuccess({ message: 'Test email sent successfully' })
  } catch {
    return apiError('Internal server error', 500)
  }
}
