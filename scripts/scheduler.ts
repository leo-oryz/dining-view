import 'dotenv/config'
import cron from 'node-cron'
import { execSync } from 'child_process'
import { createServer } from 'http'
import path from 'path'

const AGENT_DIR = path.resolve(__dirname, '../agents/download-agent')
const BASE_URL = process.env.AGENT_UPLOAD_BASE_URL || 'http://localhost:3000'
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '8080', 10)

// --- Health check server (keeps Zeabur from killing the container) ---
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

// Download agent: 00:30 daily
cron.schedule('30 0 * * *', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running download agent`)
  try {
    execSync('npx tsx index.ts', {
      cwd: AGENT_DIR,
      stdio: 'inherit',
      timeout: 600_000, // 10 min
    })
    console.log('[scheduler] Download agent completed')
  } catch (err) {
    console.error('[scheduler] Download agent failed:', err)
  }
  heartbeat()
}, { timezone: 'Asia/Taipei' })

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
}, { timezone: 'Asia/Taipei' })

// Google sync: 02:00 daily
cron.schedule('0 2 * * *', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running Google sync`)
  try {
    const res = await fetch(`${BASE_URL}/api/google/sync`, { method: 'POST' })
    const json = await res.json()
    console.log('[scheduler] Google sync result:', json)
  } catch (err) {
    console.error('[scheduler] Google sync failed:', err)
  }
  heartbeat()
}, { timezone: 'Asia/Taipei' })

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
}, { timezone: 'Asia/Taipei' })

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
}, { timezone: 'Asia/Taipei' })

// Anomaly detection moved to GitHub Actions (.github/workflows/daily-download.yml)
// so it runs immediately after the daily data download finishes. The previous
// 03:00 schedule here fired before that download (which now runs ~11:00 Taipei
// via CI), so it always analysed stale data — and the Zeabur scheduler container
// is itself unreliable across restarts.

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
}, { timezone: 'Asia/Taipei' })

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
}, { timezone: 'Asia/Taipei' })

// Weekly AI report moved to GitHub Actions (.github/workflows/weekly-ai-report.yml)
// so it runs Monday 11:00 Vietnam time with a freshness-check + auto-backfill
// step that this Zeabur container can't perform (no Playwright/Chrome).

// --- Heartbeat update after each job ---
function heartbeat() {
  lastHeartbeat = new Date().toISOString()
}

// Update heartbeat every 5 minutes to show the process is alive
setInterval(heartbeat, 5 * 60 * 1000)

// --- Process crash guard ---
process.on('uncaughtException', (err) => {
  console.error('[scheduler] Uncaught exception (process kept alive):', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[scheduler] Unhandled rejection (process kept alive):', reason)
})

console.log('[scheduler] Started. Schedules:')
console.log('  00:30 — Download agent (eat365 + Ocard)')
console.log('  01:00 — Weather sync (CWA)')
console.log('  02:00 — Google sync (GSC + GA4)')
console.log('  02:45 — TikTok Ads sync')
console.log('  03:30 — KOL posts sync (Apify)')
console.log('  Mon 04:00 — Google Reviews sync (Apify)')
console.log('  Mon 08:00 — Weekly digest email')
console.log('  (Weekly AI report runs in GitHub Actions, not here)')
console.log(`  Base URL: ${BASE_URL}`)
console.log(`  Timezone: Asia/Taipei`)
