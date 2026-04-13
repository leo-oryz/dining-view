import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser, BrowserContext, Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import { readEat365VerificationCode } from './gmail-reader'

// Stealth plugin masks headless browser fingerprints so Cloudflare Turnstile
// on the Transaction Report page is more likely to pass without a challenge.
chromium.use(StealthPlugin())

const DOWNLOAD_DIR = path.join(__dirname, 'downloads')
const SESSION_FILE = path.join(__dirname, 'eat365-session.json')
const BASE_URL = 'https://mpphk.eats365pos.com'
const RESTAURANT_PARAMS = 'restaurantCode=TWTP001206&u=0&organizationUID=114791&brandUID=117072'

export type DownloadedFile = {
  reportType: string
  filePath: string
  fileName: string
  storeId?: string
  date?: string
}

export type StoreCredentials = {
  email: string
  password: string
}

async function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
  }
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  // Use saved session if available
  if (fs.existsSync(SESSION_FILE)) {
    console.log('[eat365] Using saved session')
    return browser.newContext({
      storageState: SESSION_FILE,
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    })
  }
  return browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  })
}

/**
 * Auto-login to eat365: enter credentials → read verification code from Gmail → submit
 * Saves session on success so future runs skip login.
 */
async function autoLogin(page: Page, context: BrowserContext, credentials?: StoreCredentials) {
  const email = credentials?.email || process.env.EAT365_LOGIN_EMAIL
  const password = credentials?.password || process.env.EAT365_LOGIN_PASSWORD

  if (!email || !password) {
    throw new Error('eat365 login credentials required (EAT365_LOGIN_EMAIL / EAT365_LOGIN_PASSWORD)')
  }

  console.log('[eat365] Session expired — performing auto-login...')
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle', timeout: 30000 })

  // Step 1: Enter credentials and submit
  await page.fill('#username', email)
  await page.fill('#password', password)
  await page.click('div.sign-in-btn')
  console.log('[eat365] Credentials submitted, waiting for verification page...')

  // Wait for URL to transition to /verify (or any non sign-in page) instead of a fixed sleep
  await page.waitForURL((url) => {
    const u = url.toString()
    return u.includes('/verify') || (!u.includes('/sign-in'))
  }, { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})

  // Dismiss any modals that may overlay the OTP buttons (e.g. Change Log popup)
  await dismissModals(page)

  // Step 2: Click "Email" button to trigger verification code email.
  // The button sometimes resolves but isn't immediately visible — wait for visible,
  // scroll into view, and fall back to force click / JS click if needed.
  const emailBtn = page.locator('div.otp-request-btn[data-option="1"]').first()
  try {
    await emailBtn.waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    console.warn('[eat365] Email OTP button never became visible, attempting force click anyway')
    await page.screenshot({ path: path.join(__dirname, 'debug_verify_page.png') }).catch(() => {})
  }
  if (await emailBtn.count() > 0) {
    await emailBtn.scrollIntoViewIfNeeded().catch(() => {})
    try {
      await emailBtn.click({ timeout: 5000 })
    } catch {
      // Fallback 1: force click (ignores visibility/stability checks)
      try {
        await emailBtn.click({ force: true, timeout: 5000 })
        console.log('[eat365] Clicked Email OTP button via force click')
      } catch {
        // Fallback 2: dispatch click event directly via DOM
        await emailBtn.evaluate((el: HTMLElement) => el.click())
        console.log('[eat365] Clicked Email OTP button via DOM event')
      }
    }
    console.log('[eat365] Clicked "Email" to request verification code...')
    await page.waitForTimeout(2000)
  } else {
    console.warn('[eat365] Email OTP button not found, verification email may not be sent')
  }

  // Step 3: Read verification code from Gmail
  console.log('[eat365] Reading verification code from Gmail...')
  const code = await readEat365VerificationCode({ timeoutSeconds: 90, pollIntervalMs: 3000 })

  // Step 4: Fill first 5 digits of verification code (pc1~pc5)
  // Each input enables only after the previous one is filled
  const digits = code.split('')
  for (let i = 0; i < 5; i++) {
    const input = page.locator(`#pc${i + 1}`)
    await input.waitFor({ state: 'attached', timeout: 5000 })
    await input.focus()
    await page.keyboard.press(digits[i])
    await page.waitForTimeout(300)
  }

  // Step 5: Check "Don't ask for this device" BEFORE entering the 6th digit
  // (6th digit triggers auto-submit, so we must check this first)
  const dontAskCheckbox = page.locator('#dont-ask-device')
  if (await dontAskCheckbox.count() > 0) {
    await dontAskCheckbox.check()
    console.log('[eat365] Checked "Don\'t ask for this device"')
  }

  // Step 6: Enter the 6th digit — this triggers auto-submit
  const lastInput = page.locator('#pc6')
  await lastInput.waitFor({ state: 'attached', timeout: 5000 })
  await lastInput.focus()
  await page.keyboard.press(digits[5])
  console.log('[eat365] Entered verification code (auto-submitting...)')

  // Wait for redirect away from sign-in
  await page.waitForURL((url) => {
    const u = url.toString()
    return !u.includes('/sign-in') && !u.includes('/verify')
  }, { timeout: 30000 })
  console.log('[eat365] Login successful! URL:', page.url())
  await page.waitForLoadState('networkidle').catch(() => {})

  // Save session for future runs
  const state = await context.storageState()
  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2))
  console.log('[eat365] Session saved to', SESSION_FILE)
}

// Transaction Report is protected by a broken Cloudflare Turnstile widget
// (site key 600010 error — invalid for hostname). Stealth plugin alone can't
// solve it, so we replaced it with the Daily Closing Report JSON API which
// also exposes the dine-in / takeout breakdown — see fetchEat365DailyClosing.
const EAT365_REPORTS = [
  { type: 'eat365-summary', path: '/v2/report/sales_summary' },
  { type: 'eat365-hourly', path: '/v2/report/sales/hourly_sales_report' },
  { type: 'eat365-items', path: '/v2/report/sales/sales_by_items' },
]

/**
 * Clear saved session so next createContext starts fresh.
 */
function clearSession() {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE)
    console.log('[eat365] Cleared expired session file')
  }
}

/**
 * Try clicking Export and downloading the file.
 * Returns the Download on success, or null on failure.
 */
/**
 * Dismiss any modal/popup dialogs (e.g. "Change Log" notification).
 */
async function dismissModals(page: Page) {
  const modalBtns = [
    'button:has-text("Got it")',
    'button:has-text("OK")',
    'button:has-text("Close")',
    '.modal .btn-primary',
    '.modal .btn-success',
    '.swal2-confirm',
    'button.close[data-dismiss="modal"]',
  ]
  for (const sel of modalBtns) {
    const btn = page.locator(sel)
    if (await btn.count() > 0) {
      await btn.first().click({ force: true }).catch(() => {})
      console.log(`[eat365] Dismissed modal via ${sel}`)
      await page.waitForTimeout(1000)
      return
    }
  }
}

/**
 * Wait for Cloudflare Turnstile / managed challenge to clear. Returns true if
 * the page is usable, false if the challenge is still blocking us. Only
 * relevant for the Transaction Report page.
 */
async function waitForCloudflare(page: Page, reportType: string): Promise<boolean> {
  const cfSelectors = [
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[title*="challenge"]',
    'div.cf-turnstile',
    '#challenge-running',
    '#challenge-stage',
  ]
  const deadline = Date.now() + 30000
  let sawChallenge = false
  while (Date.now() < deadline) {
    let present = false
    for (const sel of cfSelectors) {
      if (await page.locator(sel).count() > 0) {
        present = true
        sawChallenge = true
        break
      }
    }
    if (!present) return true
    await page.waitForTimeout(1000)
  }
  if (sawChallenge) {
    console.warn(`[eat365] Cloudflare challenge did not clear for ${reportType} after 30s`)
    await page.screenshot({ path: path.join(__dirname, `debug_cf_${reportType}.png`) }).catch(() => {})
  }
  return false
}

async function tryExport(page: Page, reportType: string, debug = false): Promise<any | null> {
  // Wait for any loading overlay to disappear
  const loadingOverlay = page.locator('.vld-container .vl-background, .loading-overlay')
  await loadingOverlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

  // Transaction Report sits behind a Cloudflare Turnstile challenge. Give it
  // time to auto-resolve (stealth plugin may be enough for managed challenge).
  if (reportType === 'eat365-transactions') {
    const cleared = await waitForCloudflare(page, reportType)
    if (!cleared) return null
  }

  // Dismiss any modal popups (e.g. "Change Log" notification)
  await dismissModals(page)

  if (debug) {
    await page.screenshot({ path: path.join(__dirname, `debug_export_${reportType}.png`) })
    console.log(`[eat365] Debug screenshot saved for ${reportType}, URL: ${page.url()}`)
  }

  const exportBtn = page.locator('button:has-text("Export")')
  if (await exportBtn.count() === 0) {
    console.warn(`[eat365] No Export button found for ${reportType}`)
    return null
  }

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    exportBtn.first().click(),
  ])
  return download
}

export async function downloadEat365Reports(options?: {
  storeId?: string
  credentials?: StoreCredentials
  targetDate?: string // YYYY-MM-DD, defaults to yesterday
}): Promise<DownloadedFile[]> {
  await ensureDownloadDir()
  const dateStr = options?.targetDate || getYesterday()
  const files: DownloadedFile[] = []
  let browser: Browser | null = null
  let sessionRetried = false

  try {
    // Use installed Chrome (channel: 'chrome') in non-headless mode for the
    // Transaction Report's Cloudflare Turnstile to auto-pass. Headless +
    // bundled chromium gets challenged. Falls back to bundled chromium if
    // Chrome isn't installed.
    try {
      browser = await chromium.launch({ headless: false, channel: 'chrome' })
    } catch (err) {
      console.warn('[eat365] Chrome channel unavailable, falling back to bundled chromium:', err instanceof Error ? err.message : err)
      browser = await chromium.launch({ headless: false })
    }
    let context = await createContext(browser)
    let page = await context.newPage()

    for (const report of EAT365_REPORTS) {
      try {
        const url = `${BASE_URL}${report.path}?${RESTAURANT_PARAMS}&startDate=${dateStr}+00:00&endDate=${dateStr}+23:59`
        console.log(`[eat365] Loading ${report.type} for ${dateStr}...`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForLoadState('networkidle').catch(() => {})

        // Auto-login if session expired (detected by URL redirect)
        if (page.url().includes('/sign-in') || page.url().includes('/verify')) {
          clearSession()
          await autoLogin(page, context, options?.credentials)
          sessionRetried = true
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForLoadState('networkidle').catch(() => {})
        }

        await page.waitForTimeout(3000)

        let download = await tryExport(page, report.type).catch(() => null)

        // If download failed and we haven't retried yet, session may be expired
        // without a redirect (stale cookies). Clear session, re-login, retry.
        if (!download && !sessionRetried) {
          console.log(`[eat365] Download failed for ${report.type} — session may be stale, re-logging in...`)
          clearSession()
          // Close old context and create a fresh one
          await context.close()
          context = await createContext(browser)
          page = await context.newPage()
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForLoadState('networkidle').catch(() => {})
          await autoLogin(page, context, options?.credentials)
          sessionRetried = true
          // Retry the report page
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForLoadState('networkidle').catch(() => {})
          await page.waitForTimeout(3000)
          download = await tryExport(page, report.type, true).catch((err) => {
            console.error(`[eat365] Retry also failed for ${report.type}:`, err)
            return null
          })
        }

        if (!download) continue

        const suggestedName = download.suggestedFilename()
        const ext = path.extname(suggestedName) || '.xlsx'
        const fileName = `${report.type}_${dateStr}${ext}`
        const filePath = path.join(DOWNLOAD_DIR, fileName)
        await download.saveAs(filePath)

        files.push({ reportType: report.type, filePath, fileName, storeId: options?.storeId, date: dateStr })
        console.log(`[eat365] Downloaded: ${fileName}`)
      } catch (err) {
        console.error(`[eat365] Failed to download ${report.type}:`, err)
      }
    }

    // Daily Closing Report — JSON API replacement for the broken Transaction Report.
    // Captures the SPA's own /report/dailyReport response by navigating to the
    // daily_closing page; the SPA injects the XSRF token automatically.
    try {
      const dcrFile = await fetchEat365DailyClosing(page, dateStr, options?.storeId)
      if (dcrFile) {
        files.push(dcrFile)
        console.log(`[eat365] Downloaded: ${dcrFile.fileName}`)
      }
    } catch (err) {
      console.error('[eat365] Failed to fetch daily closing report:', err)
    }
  } finally {
    if (browser) await browser.close()
  }

  return files
}

/**
 * Navigate to the Daily Closing Report page for one date and capture the
 * /report/dailyReport JSON response. The SPA injects the XSRF token & cookies
 * automatically, so we don't have to worry about CSRF or Turnstile here.
 */
async function fetchEat365DailyClosing(
  page: Page,
  dateStr: string,
  storeId?: string
): Promise<DownloadedFile | null> {
  const url = `${BASE_URL}/v2/report/daily_closing?${RESTAURANT_PARAMS}&startDate=${dateStr}+00:00&endDate=${dateStr}+23:59`
  console.log(`[eat365] Loading daily-closing for ${dateStr}...`)

  let captured: unknown = null
  const handler = async (resp: import('playwright').Response) => {
    if (resp.url().includes('/report/dailyReport') && resp.status() === 200) {
      try {
        captured = await resp.json()
      } catch {}
    }
  }
  page.on('response', handler)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for the API response specifically
    await page.waitForResponse(
      (r) => r.url().includes('/report/dailyReport') && r.status() === 200,
      { timeout: 30000 }
    ).catch(() => {})
    await page.waitForTimeout(1500)
  } finally {
    page.off('response', handler)
  }

  if (!captured) {
    console.warn(`[eat365] No daily-closing response captured for ${dateStr}`)
    return null
  }

  const fileName = `eat365-daily-closing_${dateStr}.json`
  const filePath = path.join(DOWNLOAD_DIR, fileName)
  fs.writeFileSync(filePath, JSON.stringify({ date: dateStr, json: captured }, null, 2))
  return { reportType: 'eat365-daily-closing', filePath, fileName, storeId, date: dateStr }
}
