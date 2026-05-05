import 'dotenv/config'
import cron from 'node-cron'
import { createServer } from 'http'
import { APP_TIMEZONE } from '../lib/constants/timezone'

const BASE_URL = process.env.AGENT_UPLOAD_BASE_URL || 'http://localhost:3000'
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '8080', 10)

let lastHeartbeat = new Date().toISOString()

const healthServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', lastHeartbeat, uptime: process.uptime() }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`[scheduler] Health check listening on :${HEALTH_PORT}`)
})

// Weather sync: 01:00 daily
cron.schedule('0 1 * * *', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running weather sync`)
  try {
    const res = await fetch(`${BASE_URL}/api/weather/sync`, { method: 'POST' })
    const json = await res.json()
    console.log('[scheduler] Weather sync result:', json)
  } catch (err) {
    console.error('[scheduler] Weather sync failed:', err)
  }
  heartbeat()
}, { timezone: APP_TIMEZONE })

// TikTok Ads sync: 02:45 daily
cron.schedule('45 2 * * *', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running TikTok Ads sync`)
  try {
    const res = await fetch(`${BASE_URL}/api/sync/tiktok-ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const json = await res.json()
    console.log('[scheduler] TikTok Ads sync result:', json)
  } catch (err) {
    console.error('[scheduler] TikTok Ads sync failed:', err)
  }
  heartbeat()
}, { timezone: APP_TIMEZONE })

// KOL posts sync: 03:30 daily
cron.schedule('30 3 * * *', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running KOL posts sync`)
  try {
    const res = await fetch(`${BASE_URL}/api/kol/sync-all`, { method: 'POST' })
    const json = await res.json()
    console.log('[scheduler] KOL sync result:', json)
  } catch (err) {
    console.error('[scheduler] KOL sync failed:', err)
  }
  heartbeat()
}, { timezone: APP_TIMEZONE })

// Google Reviews sync: Monday 04:00
cron.schedule('0 4 * * 1', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running Google Reviews sync`)
  try {
    const res = await fetch(`${BASE_URL}/api/reviews/sync`, {
      method: 'POST',
    })
    const json = await res.json()
    console.log('[scheduler] Google Reviews sync result:', json)
  } catch (err) {
    console.error('[scheduler] Google Reviews sync failed:', err)
  }
  heartbeat()
}, { timezone: APP_TIMEZONE })

// Weekly digest: Monday 08:00
cron.schedule('0 8 * * 1', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Sending weekly digest`)
  try {
    const res = await fetch(`${BASE_URL}/api/digest/send`, {
      method: 'POST',
    })
    const json = await res.json()
    console.log('[scheduler] Weekly digest result:', json)
  } catch (err) {
    console.error('[scheduler] Weekly digest failed:', err)
  }
  heartbeat()
}, { timezone: APP_TIMEZONE })

function heartbeat() {
  lastHeartbeat = new Date().toISOString()
}

setInterval(heartbeat, 5 * 60 * 1000)

process.on('uncaughtException', (err) => {
  console.error('[scheduler] Uncaught exception (process kept alive):', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[scheduler] Unhandled rejection (process kept alive):', reason)
})

console.log('[scheduler] Started. Schedules:')
console.log('  01:00 — Weather sync')
console.log('  02:45 — TikTok Ads sync')
console.log('  03:30 — KOL posts sync (Apify)')
console.log('  Mon 04:00 — Google Reviews sync (Apify)')
console.log('  Mon 08:00 — Weekly digest email')
console.log(`  Base URL: ${BASE_URL}`)
console.log(`  Timezone: ${APP_TIMEZONE}`)
