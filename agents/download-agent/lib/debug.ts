import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from 'playwright'
import { ENV } from './env'
import { log } from './log'

const DEBUG_DIR = resolve(process.cwd(), 'downloads', '_debug')
mkdirSync(DEBUG_DIR, { recursive: true })

// Save a screenshot + HTML snapshot. Discovery-gated so noisy step-by-step
// captures don't blow up CI disk on every run — but error-path callers should
// use `snapshotForce()` to capture state regardless of the flag, which is what
// gets us a working DOM dump when selectors fail in CI.
export async function snapshot(page: Page, tag: string): Promise<void> {
  if (!ENV.DISCOVERY) return
  await snapshotForce(page, tag)
}

export async function snapshotForce(page: Page, tag: string): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const safe = tag.replace(/[^a-z0-9_-]+/gi, '_')
  const png = resolve(DEBUG_DIR, `${ts}__${safe}.png`)
  const html = resolve(DEBUG_DIR, `${ts}__${safe}.html`)
  try {
    await page.screenshot({ path: png, fullPage: true })
    const body = await page.content()
    const fs = await import('node:fs/promises')
    await fs.writeFile(html, body, 'utf8')
    log.info(`📸 snapshot saved: ${png}`)
  } catch (e) {
    log.warn(`snapshot failed for ${tag}:`, e)
  }
}

export async function pauseIfDiscovery(page: Page, hint: string): Promise<void> {
  if (!ENV.DISCOVERY) return
  // page.pause() blocks waiting for the user to click resume in the headed
  // browser inspector, which doesn't exist in headless. No-op there.
  if (!ENV.HEADED) return
  log.warn(`⏸  DISCOVERY pause — ${hint}`)
  log.warn('   Inspect the browser, then run `await page.evaluate(() => 0)` in DevTools or close the inspector to continue.')
  await page.pause()
}
