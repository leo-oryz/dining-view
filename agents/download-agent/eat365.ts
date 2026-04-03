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
  const email = credentials?.email || process.env.EAT365_LOGIN_EMAIL
  const password = credentials?.password || process.env.EAT365_LOGIN_PASSWORD

  if (!email || !password) {
    throw new Error('EAT365 login credentials required (via store config or env vars)')
  }

  await page.goto('https://mpphk.eats365pos.com/sign-in', { waitUntil: 'networkidle' })
  await page.fill('#username', email)
  await page.fill('#password', password)
  await page.click('div.sign-in-btn')
  await page.waitForNavigation({ waitUntil: 'networkidle' })
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Download all 4 eat365 reports for yesterday.
 * This is a template — actual selectors need to be adapted to the eat365 backend UI.
 */
export async function downloadEat365Reports(options?: { storeId?: string; credentials?: StoreCredentials }): Promise<DownloadedFile[]> {
  await ensureDownloadDir()
  const yesterday = getYesterday()
  const files: DownloadedFile[] = []
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ acceptDownloads: true })
    const page = await context.newPage()

    await login(page, options?.credentials)

    // Report configurations — selectors are placeholders to be adapted
    const reports = [
      { type: 'eat365-summary', nav: '營業報表', sub: '營業總表', ext: '.xlsx' },
      { type: 'eat365-hourly', nav: '營業報表', sub: '時段營業報表', ext: '.xls' },
      { type: 'eat365-items', nav: '營業報表', sub: '商品銷售報表', ext: '.xls' },
      { type: 'eat365-transactions', nav: '營業報表', sub: '交易明細', ext: '.csv' },
    ]

    for (const report of reports) {
      try {
        // Navigate to report page
        await page.click(`text=${report.nav}`)
        await page.click(`text=${report.sub}`)
        await page.waitForLoadState('networkidle')

        // Set date range to yesterday
        const dateInputs = page.locator('input[type="date"]')
        if (await dateInputs.count() >= 2) {
          await dateInputs.nth(0).fill(yesterday)
          await dateInputs.nth(1).fill(yesterday)
        }

        // Click search/query button
        const searchBtn = page.locator('button:has-text("查詢"), button:has-text("搜尋")')
        if (await searchBtn.count() > 0) {
          await searchBtn.first().click()
          await page.waitForLoadState('networkidle')
        }

        // Click export/download button
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.click('button:has-text("匯出"), button:has-text("下載"), a:has-text("匯出")'),
        ])

        const fileName = `${report.type}_${yesterday}${report.ext}`
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
