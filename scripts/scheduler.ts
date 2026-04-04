import 'dotenv/config'
import cron from 'node-cron'
import { execSync } from 'child_process'
import path from 'path'

const AGENT_DIR = path.resolve(__dirname, '../agents/download-agent')
const BASE_URL = process.env.AGENT_UPLOAD_BASE_URL || 'http://localhost:3000'

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
}, { timezone: 'Asia/Taipei' })

// Anomaly detection: 03:00 daily
cron.schedule('0 3 * * *', async () => {
  console.log(`[scheduler] ${new Date().toISOString()} — Running anomaly detection`)
  try {
    const res = await fetch(`${BASE_URL}/api/alerts/detect`, {
      method: 'POST',
    })
    const json = await res.json()
    console.log('[scheduler] Anomaly detection result:', json)
  } catch (err) {
    console.error('[scheduler] Anomaly detection failed:', err)
  }
}, { timezone: 'Asia/Taipei' })

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
}, { timezone: 'Asia/Taipei' })

console.log('[scheduler] Started. Schedules:')
console.log('  00:30 — Download agent (eat365 + Ocard)')
console.log('  01:00 — Weather sync (CWA)')
console.log('  02:00 — Google sync (GSC + GA4)')
console.log('  02:45 — TikTok Ads sync')
console.log('  03:00 — Anomaly detection + LINE alerts')
console.log('  03:30 — KOL posts sync (Apify)')
console.log('  Mon 04:00 — Google Reviews sync (Apify)')
console.log('  Mon 08:00 — Weekly digest email')
console.log(`  Base URL: ${BASE_URL}`)
console.log(`  Timezone: Asia/Taipei`)
