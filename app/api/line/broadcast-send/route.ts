import { createServiceClient } from '@/lib/supabase/server'
import { sendBroadcast } from '@/lib/line/broadcastSender'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, message } = body

    if (!title || !message) {
      return apiError('title and message are required', 400)
    }

    // Send broadcast via LINE Messaging API
    const result = await sendBroadcast(message)

    if (!result.success) {
      return apiError(result.error || 'Failed to send broadcast', 500)
    }

    // Record the broadcast in DB
    const supabase = createServiceClient()
    const url = new URL(request.url)
    const storeId = getStoreId(url.searchParams)
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('line_broadcasts')
      .upsert({
        store_id: storeId,
        broadcast_date: today,
        title,
        message,
        target_audience: '全部好友',
      }, { onConflict: 'store_id,broadcast_date,title' })
      .select()
      .single()

    if (error) {
      // Broadcast was sent successfully, but DB record failed — still report success
      console.error('[broadcast-send] DB record failed:', error.message)
      return apiSuccess({ sent: true, recorded: false, error: error.message })
    }

    return apiSuccess({ sent: true, recorded: true, broadcast: data })
  } catch {
    return apiError('Internal server error', 500)
  }
}
