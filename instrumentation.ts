export async function register() {
  // Only run cron on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron')

    // Daily sync at 06:00 Asia/Taipei
    // Meta ads data has ~24h delay, so syncing at 6am covers yesterday's data
    cron.default.schedule('0 6 * * *', async () => {
      const port = process.env.PORT || '3000'
      const baseUrl = `http://localhost:${port}`
      const secret = process.env.CRON_SECRET

      if (!secret) {
        console.error('[cron-scheduler] CRON_SECRET not set, skipping daily sync')
        return
      }

      console.log(`[cron-scheduler] Triggering daily sync at ${new Date().toISOString()}`)

      try {
        const res = await fetch(`${baseUrl}/api/cron/daily?secret=${encodeURIComponent(secret)}`, {
          method: 'GET',
        })
        const json = await res.json()
        console.log('[cron-scheduler] Daily sync result:', JSON.stringify(json.data))
      } catch (err) {
        console.error('[cron-scheduler] Daily sync failed:', err)
      }
    }, {
      timezone: 'Asia/Taipei',
    })

    console.log('[cron-scheduler] Daily sync scheduled at 06:00 Asia/Taipei')
  }
}
