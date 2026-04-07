const LINE_BROADCAST_API = 'https://api.line.me/v2/bot/message/broadcast'

export async function sendBroadcast(message: string): Promise<{ success: boolean; error?: string }> {
  const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!channelToken) {
    console.warn('[broadcastSender] Missing LINE_CHANNEL_ACCESS_TOKEN')
    return { success: false, error: 'LINE credentials not configured' }
  }

  try {
    const res = await fetch(LINE_BROADCAST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[broadcastSender] LINE API error (${res.status}):`, body)
      return { success: false, error: `LINE API error: ${res.status}` }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[broadcastSender] Failed to send:', msg)
    return { success: false, error: msg }
  }
}
