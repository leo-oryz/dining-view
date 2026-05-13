import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from 'playwright'
import { ENV } from './env'
import { log } from './log'

const DEBUG_DIR = resolve(process.cwd(), 'downloads', '_debug')
mkdirSync(DEBUG_DIR, { recursive: true })

// Save a screenshot + HTML snapshot. Idempotent dir. Tagged so multiple runs
// don't clobber each other; useful when a step fails on CI and we need to
// inspect what the page actually looked like.
export async function snapshot(page: Page, tag: string): Promise<void> {
  if (!ENV.DISCOVERY) return
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
  log.warn(`⏸  DISCOVERY pause — ${hint}`)
  log.warn('   Inspect the browser, then run `await page.evaluate(() => 0)` in DevTools or close the inspector to continue.')
  await page.pause()
}
