// One-shot discovery: launch chromium against fabi.ipos.vn, attempt login with
// IPOS_EMAIL + IPOS_PASSWORD from env, dump screenshots + HTML at each step.
// Bypasses Supabase entirely — useful when .env.local has no Supabase creds
// yet and we just want to validate selectors / report URLs.
//
// Usage:
//   IPOS_EMAIL=foo@bar IPOS_PASSWORD=xxx PLAYWRIGHT_HEADED=1 IPOS_DISCOVERY=1 \
//     npx tsx scripts/discover-login.ts

import { ENV } from '../lib/env'
import { log } from '../lib/log'
import { IposScraper } from '../lib/ipos-scraper'

async function main() {
  const email = process.env.IPOS_EMAIL?.trim()
  const password = process.env.IPOS_PASSWORD?.trim()
  if (!email || !password) {
    log.err('Set IPOS_EMAIL and IPOS_PASSWORD env vars to run discovery without Supabase.')
    log.err('Example:')
    log.err('  IPOS_EMAIL=you@example.com IPOS_PASSWORD=xxxx \\')
    log.err('    PLAYWRIGHT_HEADED=1 IPOS_DISCOVERY=1 npx tsx scripts/discover-login.ts')
    process.exit(2)
  }

  // Force discovery defaults if caller forgot the flags — this script only
  // makes sense in discovery mode.
  if (!ENV.HEADED) log.warn('PLAYWRIGHT_HEADED not set — running headless (no browser window will appear)')
  if (!ENV.DISCOVERY) log.warn('IPOS_DISCOVERY not set — screenshots will NOT be saved to downloads/_debug/')

  const scraper = new IposScraper({ email, password })
  try {
    await scraper.start()
    await scraper.login()
    await scraper.selectBrandIfNeeded()
    log.info('✓ login succeeded. Inspect downloads/_debug/ for screenshots.')
    log.info('Next: open each report URL in REPORT_ROUTES (ipos-scraper.ts) and confirm the slugs are right.')
  } catch (err) {
    log.err(`discovery failed: ${err instanceof Error ? err.message : err}`)
    log.err('Check downloads/_debug/ for the snapshot just before the failure.')
    process.exitCode = 1
  } finally {
    await scraper.stop()
  }
}

main().catch(e => { log.err('fatal:', e); process.exit(1) })
