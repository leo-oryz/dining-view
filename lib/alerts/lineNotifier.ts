const LINE_MESSAGING_API = 'https://api.line.me/v2/bot/message/push'

/**
 * Send a push message via LINE Messaging API to the owner.
 * Requires LINE_CHANNEL_ACCESS_TOKEN and LINE_OWNER_USER_ID env vars.
 */
export async function sendLineAlert(message: string): Promise<{ success: boolean; error?: string }> {
  const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const userId = process.env.LINE_OWNER_USER_ID

  if (!channelToken || !userId) {
    console.warn('[lineNotifier] Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_OWNER_USER_ID')
    return { success: false, error: 'LINE credentials not configured' }
  }

  try {
    const res = await fetch(LINE_MESSAGING_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelToken}`,
      },
      body: JSON.stringify({
        to: userId,
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
      console.error(`[lineNotifier] LINE API error (${res.status}):`, body)
      return { success: false, error: `LINE API error: ${res.status}` }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[lineNotifier] Failed to send:', msg)
    return { success: false, error: msg }
  }
}
