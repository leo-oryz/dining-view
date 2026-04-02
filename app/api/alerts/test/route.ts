import { sendLineAlert } from '@/lib/alerts/lineNotifier'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function POST() {
  try {
    const testMessage = `FnB Pulse 測試通知\n\n這是一則測試訊息，確認 LINE 推播功能正常運作。\n\n時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`

    const result = await sendLineAlert(testMessage)

    if (!result.success) {
      return apiError(result.error || 'Failed to send test notification', 500)
    }

    return apiSuccess({ message: 'Test notification sent successfully' })
  } catch {
    return apiError('Internal server error', 500)
  }
}
