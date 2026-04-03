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

  await page.goto('https://crm.ocard.co/Login', { waitUntil: 'networkidle' })
  await page.fill('input[name="acc"]', email)
  await page.fill('input[name="pwd"]', password)
  await page.click('button:has-text("登入")')
  await page.waitForURL((url) => !url.toString().includes('/Login'), { timeout: 30000 })
  await page.waitForLoadState('networkidle').catch(() => {})
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Set date range on Ocard pages using the daterangepicker.
 * Ocard uses format "YYYY/MM/DD".
 */
async function setDateRange(page: Page, dateStr: string) {
  const formatted = dateStr.replace(/-/g, '/')
  const rangeValue = `${formatted} ～ ${formatted}`

  // Use the visible date range input (not hidden ones)
  const rangeInput = page.locator('input[name="range"][type="text"]:visible').first()
  if (await rangeInput.count() > 0) {
    // Set value via JS to bypass readonly
    await page.evaluate(({ val }) => {
      const input = document.querySelector('input[name="range"][type="text"]') as HTMLInputElement
      if (input) {
        input.value = val
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      // Also try the hidden range input inside the form
      const hidden = document.querySelector('input[name="range"][type="hidden"]') as HTMLInputElement
      if (hidden) {
        hidden.value = val
        hidden.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, { val: rangeValue })

    // Set dates via JS and trigger change to reload data
    await page.evaluate(({ start, end, range }) => {
      // Set the daterangepicker via jQuery if available
      const $ = (window as any).jQuery || (window as any).$
      if ($ && $('input[name="range"]').data('daterangepicker')) {
        const picker = $('input[name="range"]').data('daterangepicker')
        picker.setStartDate(start)
        picker.setEndDate(end)
        $('input[name="range"]').trigger('apply.daterangepicker', picker)
      } else {
        // Fallback: set values directly
        const rangeEl = document.querySelector('input[name="range"][type="text"]') as HTMLInputElement
        if (rangeEl) rangeEl.value = range
        const hidden = document.querySelector('input[name="range"][type="hidden"]') as HTMLInputElement
        if (hidden) hidden.value = range
      }
    }, { start: formatted, end: formatted, range: rangeValue })
    await page.waitForTimeout(3000)
  }
}

export async function downloadOcardReports(options?: {
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
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    })
    const page = await context.newPage()

    await login(page, options?.credentials)
    console.log('[ocard] Logged in successfully')

    // Ocard reports — use direct URLs instead of sidebar navigation
    const reports = [
      { type: 'ocard-dashboard', url: 'https://crm.ocard.co/Dashboard', hasDateRange: true, downloadSelector: 'a.fab-item.download, a.download' },
      { type: 'ocard-recruit', url: 'https://console.ocard.co/analysis/member/DbWobN', hasDateRange: true, downloadSelector: null },
      { type: 'ocard-consumption', url: 'https://console.ocard.co/analysis/consumption/lV09mK', hasDateRange: true, downloadSelector: null },
      { type: 'ocard-rfm', url: 'https://console.ocard.co/analysis/rfm/KbLDbe', hasDateRange: false, downloadSelector: null },
      { type: 'ocard-members', url: 'https://crm.ocard.co/Sale', hasDateRange: true, downloadSelector: null },
    ]

    for (const report of reports) {
      try {
        console.log(`[ocard] Loading ${report.type}...`)
        await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(3000)

        // Set date range if applicable
        if (report.hasDateRange) {
          await setDateRange(page, dateStr)
        }

        // Try to find and click download/export button
        let downloaded = false

        if (report.downloadSelector) {
          const dlBtn = page.locator(report.downloadSelector)
          if (await dlBtn.count() > 0) {
            const [download] = await Promise.all([
              page.waitForEvent('download', { timeout: 15000 }),
              dlBtn.first().click({ force: true }),
            ])
            const suggestedName = download.suggestedFilename()
            const ext = path.extname(suggestedName) || '.xlsx'
            const fileName = `${report.type}_${dateStr}${ext}`
            const filePath = path.join(DOWNLOAD_DIR, fileName)
            await download.saveAs(filePath)
            files.push({ reportType: report.type, filePath, fileName, storeId: options?.storeId })
            console.log(`[ocard] Downloaded: ${fileName}`)
            downloaded = true
          }
        }

        if (!downloaded) {
          // Try common export selectors
          const exportSelectors = [
            'a.fab-item.download',
            'a.download',
            'button:has-text("匯出")',
            'button:has-text("下載")',
            'a:has-text("匯出")',
            'a:has-text("下載")',
            '[class*="download"]',
            '[class*="export"]',
          ]

          for (const sel of exportSelectors) {
            const el = page.locator(sel)
            if (await el.count() > 0) {
              try {
                const [download] = await Promise.all([
                  page.waitForEvent('download', { timeout: 10000 }),
                  el.first().click({ force: true }),
                ])
                const suggestedName = download.suggestedFilename()
                const ext = path.extname(suggestedName) || '.csv'
                const fileName = `${report.type}_${dateStr}${ext}`
                const filePath = path.join(DOWNLOAD_DIR, fileName)
                await download.saveAs(filePath)
                files.push({ reportType: report.type, filePath, fileName, storeId: options?.storeId })
                console.log(`[ocard] Downloaded: ${fileName}`)
                downloaded = true
                break
              } catch {
                // Try next selector
              }
            }
          }

          if (!downloaded) {
            console.warn(`[ocard] No download button found for ${report.type}`)
          }
        }
      } catch (err) {
        console.error(`[ocard] Failed to download ${report.type}:`, err)
      }
    }
  } finally {
    if (browser) await browser.close()
  }

  return files
}
