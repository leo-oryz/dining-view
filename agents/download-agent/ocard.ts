import { chromium, type Browser, type Page } from 'playwright'
import path from 'path'
import fs from 'fs'

const DOWNLOAD_DIR = path.join(__dirname, 'downloads')

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

async function login(page: Page, credentials?: StoreCredentials) {
  const email = credentials?.email || process.env.OCARD_LOGIN_EMAIL
  const password = credentials?.password || process.env.OCARD_LOGIN_PASSWORD

  if (!email || !password) {
    throw new Error('Ocard login credentials required (via store config or env vars)')
  }

  await page.goto('https://business.ocard.co/login')
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForNavigation({ waitUntil: 'networkidle' })
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Download all Ocard reports for yesterday.
 * Selectors are placeholders — adapt to actual Ocard backend UI.
 */
export async function downloadOcardReports(options?: { storeId?: string; credentials?: StoreCredentials }): Promise<DownloadedFile[]> {
  await ensureDownloadDir()
  const yesterday = getYesterday()
  const files: DownloadedFile[] = []
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ acceptDownloads: true })
    const page = await context.newPage()

    await login(page, options?.credentials)

    const reports = [
      { type: 'ocard-dashboard', nav: '儀表板', ext: '.xlsx' },
      { type: 'ocard-recruit', nav: '會員招募分析', ext: '.csv' },
      { type: 'ocard-consumption', nav: '顧客消費分析', ext: '.csv' },
      { type: 'ocard-rfm', nav: 'RFM 分析', ext: '.csv' },
      { type: 'ocard-members', nav: '商品銷售', ext: '.csv' },
    ]

    for (const report of reports) {
      try {
        // Navigate to report section
        await page.click(`text=${report.nav}`)
        await page.waitForLoadState('networkidle')

        // Set date range
        const dateInputs = page.locator('input[type="date"]')
        if (await dateInputs.count() >= 2) {
          await dateInputs.nth(0).fill(yesterday)
          await dateInputs.nth(1).fill(yesterday)
        }

        // Search
        const searchBtn = page.locator('button:has-text("查詢"), button:has-text("搜尋")')
        if (await searchBtn.count() > 0) {
          await searchBtn.first().click()
          await page.waitForLoadState('networkidle')
        }

        // Download
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.click('button:has-text("匯出"), button:has-text("下載"), a:has-text("匯出")'),
        ])

        const fileName = `${report.type}_${yesterday}${report.ext}`
        const filePath = path.join(DOWNLOAD_DIR, fileName)
        await download.saveAs(filePath)

        files.push({ reportType: report.type, filePath, fileName, storeId: options?.storeId })
        console.log(`[ocard] Downloaded: ${fileName}`)
      } catch (err) {
        console.error(`[ocard] Failed to download ${report.type}:`, err)
      }
    }
  } finally {
    if (browser) await browser.close()
  }

  return files
}
