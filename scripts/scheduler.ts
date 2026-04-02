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

console.log('[scheduler] Started. Schedules:')
console.log('  00:30 — Download agent (eat365 + Ocard)')
console.log('  01:00 — Weather sync (CWA)')
console.log('  02:00 — Google sync (GSC + GA4)')
console.log(`  Base URL: ${BASE_URL}`)
console.log(`  Timezone: Asia/Taipei`)
