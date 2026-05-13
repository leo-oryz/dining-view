import type { Browser, BrowserContext, Download, Page } from 'playwright'
import { chromium } from 'playwright'
import { format, subDays } from 'date-fns'
import { ENV } from './env'
import { log } from './log'
import { snapshot, pauseIfDiscovery } from './debug'

export interface IposCredentials {
  email: string
  password: string
  brand_uid?: string | null
  company_uid?: string | null
}

export interface IposDownloadResult {
  sale_summary: ArrayBuffer | null
  payment_methods: ArrayBuffer | null
  items: ArrayBuffer | null
  source: ArrayBuffer | null
  range: { start: string; end: string }
}

// Each iPOS report has its own page within fabi.ipos.vn. The exact slugs depend
// on the iPOS Fabi build, so we keep them overridable via env in case the user
// runs against a slightly different deployment. Values reflect what we have
// confirmed so far; unconfirmed slugs MUST be verified in discovery mode before
// trusting the data they produce.
//
// To discover real paths: run `npm run scrape:discovery`, follow the headed
// browser to each report, and copy the URL slug here.
const REPORT_ROUTES = {
  sale_summary:    process.env.IPOS_REPORT_SALE_SUMMARY    || '/bao-cao/tong-quan-doanh-thu',
  payment_methods: process.env.IPOS_REPORT_PAYMENT_METHODS || '/bao-cao/phuong-thuc-thanh-toan',
  items:           process.env.IPOS_REPORT_ITEMS           || '/bao-cao/ban-hang-theo-mon',
  source:          process.env.IPOS_REPORT_SOURCE          || '/bao-cao/nguon-don-hang',
} as const

type ReportKey = keyof typeof REPORT_ROUTES

const DEFAULT_TIMEOUT = 45_000

export class IposScraper {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null

  constructor(private readonly creds: IposCredentials) {}

  async start(): Promise<void> {
    log.step(`launching chromium (headed=${ENV.HEADED}, discovery=${ENV.DISCOVERY})`)
    this.browser = await chromium.launch({
      headless: !ENV.HEADED,
      args: ['--disable-blink-features=AutomationControlled'],
    })
    this.context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
    })
    this.context.setDefaultTimeout(DEFAULT_TIMEOUT)
    this.page = await this.context.newPage()
  }

  async stop(): Promise<void> {
    await this.context?.close().catch(() => {})
    await this.browser?.close().catch(() => {})
    this.browser = null
    this.context = null
    this.page = null
  }

  private requirePage(): Page {
    if (!this.page) throw new Error('Scraper not started — call start() first')
    return this.page
  }

  // Login flow. iPOS Fabi is a Vue SPA; the form fields don't have stable
  // `name` attributes, so we cast a wide net via placeholder + type + label.
  // If none match, discovery mode will pause and dump screenshots so we can
  // narrow down the right selector.
  async login(): Promise<void> {
    const page = this.requirePage()
    log.step(`opening ${ENV.IPOS_BASE_URL}/login`)
    await page.goto(`${ENV.IPOS_BASE_URL}/login`, { waitUntil: 'domcontentloaded' })

    // The SPA renders client-side, so wait for the actual login form to appear
    // before probing selectors. We wait for any input element.
    await page.waitForSelector('input', { timeout: DEFAULT_TIMEOUT })
    await snapshot(page, '01_login_loaded')

    const emailField = await this.findFirstVisible(page, [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="mail" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="tài khoản" i]',
      'input[autocomplete="username"]',
      'input.email',
    ], 'email field')

    const passwordField = await this.findFirstVisible(page, [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="ật khẩu" i]',
      'input[autocomplete="current-password"]',
    ], 'password field')

    log.step(`filling credentials for ${this.creds.email}`)
    await emailField.fill(this.creds.email)
    await passwordField.fill(this.creds.password)

    const submitBtn = await this.findFirstVisible(page, [
      'button[type="submit"]',
      'button:has-text("Đăng nhập")',
      'button:has-text("Login")',
      'button:has-text("Đăng Nhập")',
      'button.login',
      'form button',
    ], 'submit button')

    await pauseIfDiscovery(page, 'about to click submit — verify fields are filled correctly')
    log.step('clicking submit')
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes('/login'), { timeout: DEFAULT_TIMEOUT })
        .catch(() => log.warn('post-login URL did not change away from /login within timeout')),
      submitBtn.click(),
    ])
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {})
    await snapshot(page, '02_after_login')

    // If still on /login, dump page text — usually means wrong creds or 2FA.
    if (page.url().includes('/login')) {
      const visibleText = await page.locator('body').innerText().catch(() => '')
      throw new Error(`Login appears to have failed (still on /login). Page text snippet: ${visibleText.slice(0, 300)}`)
    }

    log.info(`✓ logged in, landed at ${page.url()}`)
  }

  // Some accounts have to pick a brand/company after login. If brand/company
  // UIDs are supplied via credentials, try to navigate or click them; otherwise
  // just pause in discovery mode so the user can choose manually.
  async selectBrandIfNeeded(): Promise<void> {
    const page = this.requirePage()
    // Quick heuristic: if the URL contains "choose" or "brand" or there's a
    // visible list of brands, we're on the selection screen.
    const url = page.url()
    if (!/brand|choose|select|chon/i.test(url)) return

    log.step('brand selection screen detected')
    await snapshot(page, '03_brand_select')

    if (this.creds.brand_uid) {
      const target = page.locator(`[data-uid="${this.creds.brand_uid}"]`).first()
      if (await target.count() > 0) {
        await target.click()
        await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {})
        return
      }
      log.warn(`brand_uid ${this.creds.brand_uid} not found as data-uid; falling back to first option`)
    }

    // Fallback — click the first selectable brand card.
    const firstCard = page.locator('div[class*="card"], li, button').filter({ hasText: /./ }).first()
    if (await firstCard.count() > 0) {
      await firstCard.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {})
    }
  }

  async downloadAllReports(): Promise<IposDownloadResult> {
    const start = format(subDays(new Date(), ENV.IPOS_DAYS), 'yyyy-MM-dd')
    const end = format(new Date(), 'yyyy-MM-dd')

    const out: IposDownloadResult = {
      sale_summary: null,
      payment_methods: null,
      items: null,
      source: null,
      range: { start, end },
    }

    for (const key of Object.keys(REPORT_ROUTES) as ReportKey[]) {
      try {
        out[key] = await this.downloadReport(key, start, end)
      } catch (err) {
        log.err(`failed to download ${key}:`, err instanceof Error ? err.message : err)
        await snapshot(this.requirePage(), `err_${key}`)
      }
    }

    return out
  }

  private async downloadReport(key: ReportKey, start: string, end: string): Promise<ArrayBuffer> {
    const page = this.requirePage()
    const route = REPORT_ROUTES[key]
    const url = `${ENV.IPOS_BASE_URL}${route}`
    log.step(`navigating to ${key}: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {})
    await snapshot(page, `10_${key}_loaded`)

    await this.setDateRange(page, start, end, key)
    await snapshot(page, `11_${key}_date_set`)
    await pauseIfDiscovery(page, `date range set on ${key} — verify before export`)

    const download = await this.clickExport(page, key)
    log.info(`✓ download received: ${download.suggestedFilename()}`)

    const buf = await this.readDownloadBuffer(download)
    return buf
  }

  private async setDateRange(page: Page, start: string, end: string, ctx: string): Promise<void> {
    // iPOS Fabi typically uses a single date-range picker. We try a few common
    // affordances: input fields, range buttons, etc. The user should verify
    // in discovery mode and we'll tighten the selectors after first run.
    const pickerOpeners = [
      'input[placeholder*="ngày" i]',
      'input[placeholder*="date" i]',
      'input.date-range',
      'div.date-range-picker',
      'button:has-text("Tùy chỉnh")',
      'button:has-text("Khoảng thời gian")',
    ]
    let opened = false
    for (const sel of pickerOpeners) {
      const loc = page.locator(sel).first()
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        await loc.click().catch(() => {})
        opened = true
        break
      }
    }

    if (!opened) {
      log.warn(`could not find date picker for ${ctx} — falling back to whatever default range the page applies`)
      return
    }

    // Try to type values directly into start/end inputs that may have appeared.
    const startInput = page.locator('input[placeholder*="bắt đầu" i], input[placeholder*="from" i], input[name*="start" i]').first()
    const endInput = page.locator('input[placeholder*="kết thúc" i], input[placeholder*="to" i], input[name*="end" i]').first()
    if (await startInput.count() > 0) {
      await startInput.fill(this.formatDateForIpos(start)).catch(() => {})
    }
    if (await endInput.count() > 0) {
      await endInput.fill(this.formatDateForIpos(end)).catch(() => {})
    }

    // Confirm — click Apply / Áp dụng / OK.
    const apply = page.locator('button:has-text("Áp dụng"), button:has-text("Apply"), button:has-text("OK")').first()
    if (await apply.count() > 0) {
      await apply.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {})
    }
  }

  private formatDateForIpos(iso: string): string {
    // iPOS Vietnam usually shows DD/MM/YYYY in date inputs.
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  private async clickExport(page: Page, ctx: string): Promise<Download> {
    const exportSelectors = [
      'button:has-text("Xuất Excel")',
      'button:has-text("Xuất file")',
      'button:has-text("Xuất")',
      'button:has-text("Export")',
      'a:has-text("Xuất Excel")',
      'button[title*="xuất" i]',
      'button.export',
    ]

    let triggerLoc = null
    for (const sel of exportSelectors) {
      const loc = page.locator(sel).first()
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        triggerLoc = loc
        break
      }
    }

    if (!triggerLoc) {
      throw new Error(`No export button found for ${ctx}. Tried: ${exportSelectors.join(', ')}`)
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      triggerLoc.click(),
    ])
    return download
  }

  private async readDownloadBuffer(download: Download): Promise<ArrayBuffer> {
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const buf = Buffer.concat(chunks)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  private async findFirstVisible(page: Page, selectors: string[], description: string) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first()
      const count = await loc.count()
      if (count === 0) continue
      const visible = await loc.isVisible().catch(() => false)
      if (visible) {
        return loc
      }
    }
    await snapshot(page, `missing_${description.replace(/\s+/g, '_')}`)
    throw new Error(`Could not find visible ${description}. Tried: ${selectors.join(', ')}`)
  }
}
