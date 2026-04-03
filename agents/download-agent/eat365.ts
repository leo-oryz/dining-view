import { chromium, type Browser, type BrowserContext } from 'playwright'
import path from 'path'
import fs from 'fs'

const DOWNLOAD_DIR = path.join(__dirname, 'downloads')
const SESSION_FILE = path.join(__dirname, 'eat365-session.json')
const BASE_URL = 'https://mpphk.eats365pos.com'
const RESTAURANT_PARAMS = 'restaurantCode=TWTP001206&u=0&organizationUID=114791&brandUID=117072'

export type DownloadedFile = {
  reportType: string
  filePath: string
  fileName: string
  storeId?: string
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

        if (page.url().includes('/sign-in')) {
          throw new Error('Session expired — please re-run _save_session.ts to refresh MFA')
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

        files.push({ reportType: report.type, filePath, fileName, storeId: options?.storeId })
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
