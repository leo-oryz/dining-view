import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import { readEat365VerificationCode } from './gmail-reader'

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

  // Enter credentials
  await page.fill('#username', email)
  await page.fill('#password', password)
  await page.click('div.sign-in-btn')
  console.log('[eat365] Credentials submitted, waiting for verification code page...')

  // Wait for either: verification code input OR successful redirect
  await page.waitForTimeout(3000)

  // Check if we landed on a verification code page
  const codeInput = page.locator('input[placeholder*="erification"], input[type="number"], input[name*="code"], input[name*="otp"]')
  const hasCodeInput = await codeInput.count() > 0

  if (hasCodeInput || page.url().includes('verif') || page.url().includes('sign-in')) {
    console.log('[eat365] Verification code required — reading from Gmail...')
    const code = await readEat365VerificationCode({ timeoutSeconds: 90, pollIntervalMs: 3000 })

    // Try to find and fill the verification input
    // eat365 may use various input patterns for the code
    const possibleInputs = [
      'input[placeholder*="erification"]',
      'input[name*="code"]',
      'input[name*="otp"]',
      'input[type="number"]',
      'input[type="tel"]',
    ]

    let filled = false
    for (const selector of possibleInputs) {
      const input = page.locator(selector)
      if (await input.count() > 0) {
        await input.first().fill(code)
        filled = true
        console.log(`[eat365] Entered verification code via ${selector}`)
        break
      }
    }

    if (!filled) {
      // Fallback: try to fill any visible text input
      const anyInput = page.locator('input:visible').first()
      await anyInput.fill(code)
      console.log('[eat365] Entered verification code via fallback input')
    }

    // Submit the verification code
    const submitBtn = page.locator('button:has-text("Verify"), button:has-text("Submit"), button:has-text("Confirm"), div.sign-in-btn, button[type="submit"]')
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click()
    }

    // Wait for redirect away from sign-in
    await page.waitForURL((url) => !url.toString().includes('/sign-in'), { timeout: 30000 })
    console.log('[eat365] Login successful! URL:', page.url())
  }

  // Save session for future runs
  const state = await context.storageState()
  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2))
  console.log('[eat365] Session saved to', SESSION_FILE)
}

// Note: eat365-transactions (Transaction Report) is protected by Cloudflare
// Turnstile and cannot be automated. Must be downloaded manually.
const EAT365_REPORTS = [
  { type: 'eat365-summary', path: '/v2/report/sales_summary' },
  { type: 'eat365-hourly', path: '/v2/report/sales/hourly_sales_report' },
  { type: 'eat365-items', path: '/v2/report/sales/sales_by_items' },
]

export async function downloadEat365Reports(options?: {
  storeId?: string
  credentials?: StoreCredentials
  targetDate?: string // YYYY-MM-DD, defaults to yesterday
}): Promise<DownloadedFile[]> {
  await ensureDownloadDir()
  const dateStr = options?.targetDate || getYesterday()
  const files: DownloadedFile[] = []
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await createContext(browser)
    const page = await context.newPage()

    for (const report of EAT365_REPORTS) {
      try {
        const url = `${BASE_URL}${report.path}?${RESTAURANT_PARAMS}&startDate=${dateStr}+00:00&endDate=${dateStr}+23:59`
        console.log(`[eat365] Loading ${report.type} for ${dateStr}...`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForLoadState('networkidle').catch(() => {})

        // Auto-login if session expired
        if (page.url().includes('/sign-in')) {
          await autoLogin(page, context, options?.credentials)
          // Retry loading the report page after login
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForLoadState('networkidle').catch(() => {})
        }

        await page.waitForTimeout(3000)

        const exportBtn = page.locator('button:has-text("Export")')
        if (await exportBtn.count() === 0) {
          console.warn(`[eat365] No Export button found for ${report.type}`)
          continue
        }

        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          exportBtn.first().click(),
        ])

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
  } finally {
    if (browser) await browser.close()
  }

  return files
}
