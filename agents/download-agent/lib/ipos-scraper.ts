import type { Browser, BrowserContext, Download, Page } from 'playwright'
import { chromium } from 'playwright'
import { format, subDays } from 'date-fns'
import { ENV } from './env'
import { log } from './log'
import { snapshot, snapshotForce, pauseIfDiscovery } from './debug'

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

// iPOS Fabi report URLs, confirmed by walking the sidebar's @click handlers and
// grepping the resulting page's <a href> list (run 25840538034). Path prefix is
// /report/* — my earlier guesses at /bao-cao/* all 404'd. Env vars are kept as
// overrides in case a different iPOS deployment uses different slugs.
const REPORT_ROUTES = {
  sale_summary:    process.env.IPOS_REPORT_SALE_SUMMARY    || '/report/revenue/sale-summary',
  payment_methods: process.env.IPOS_REPORT_PAYMENT_METHODS || '/report/revenue/categories/payment-method',
  items:           process.env.IPOS_REPORT_ITEMS           || '/report/revenue/categories/item',
  source:          process.env.IPOS_REPORT_SOURCE          || '/report/revenue/categories/source',
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
      // Confirmed via CI artifact 25839969145 — fabi.ipos.vn names the email
      // input `email_input` with no `type` attribute and no placeholder; the
      // "Tài Khoản" label is rendered separately. Keep generic fallbacks below
      // in case iPOS swaps frameworks or A/B tests the form.
      'input[name="email_input"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="mail" i]',
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

  // Discover the iPOS Fabi report URLs by clicking through the Vue sidebar.
  // The sidebar items don't render as <a href> — they're .list-menu__item
  // divs with @click handlers that fire $router.push(), so the destination
  // is invisible in static HTML. We have to click and observe.
  //
  // Strategy: click "Báo cáo" (Reports), then click each known report name in
  // Vietnamese (matching the 4 reports the parser expects), snapshotting after
  // each so a failing CI run lands the full menu DOM + every report's landing
  // page in artifacts. URL after each click is logged so we can pin
  // REPORT_ROUTES to real slugs on the next iteration.
  async exploreDashboardMenu(): Promise<void> {
    const page = this.requirePage()
    log.step('exploring dashboard menu via clicks')
    await snapshotForce(page, 'A0_dashboard_initial')
    log.info(`URL: ${page.url()}`)

    // 1) Click "Báo cáo". Previous run targeted .list-menu__item (the outer
    // wrapper); URL didn't change because the @click handler is on the inner
    // .list-menu-item__icon div with cursor-pointer. Try the inner element
    // first, then fall back to the image and the label.
    const reportsClickTargets = [
      // Inner clickable, scoped to the Báo cáo item.
      page.locator('.list-menu__item', { hasText: 'Báo cáo' }).locator('.list-menu-item__icon, .cursor-pointer').first(),
      // The icon image is unambiguous via its alt text.
      page.locator('img[alt="Báo cáo"]'),
      // The label paragraph might be wired too.
      page.locator('p.menu-label', { hasText: 'Báo cáo' }).first(),
      // Last resort — outer div with force: true.
      page.locator('.list-menu__item', { hasText: 'Báo cáo' }).first(),
    ]
    let urlBefore = page.url()
    let navigated = false
    for (let i = 0; i < reportsClickTargets.length; i++) {
      const target = reportsClickTargets[i]
      if (await target.count() === 0) continue
      try {
        await target.click({ timeout: 5_000, force: i === reportsClickTargets.length - 1 })
      } catch (e) {
        log.warn(`Báo cáo click attempt ${i} failed: ${e instanceof Error ? e.message : e}`)
        continue
      }
      await page.waitForTimeout(900)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const urlAfter = page.url()
      log.info(`Báo cáo click attempt ${i}: ${urlBefore} → ${urlAfter}`)
      if (urlAfter !== urlBefore || urlAfter !== `${ENV.IPOS_BASE_URL}/dashboard`) {
        navigated = true
        break
      }
      // No nav; maybe a popout opened. Snapshot the state, then move on.
      await snapshotForce(page, `B1_popout_attempt_${i}`)
      urlBefore = urlAfter
    }
    log.info(`after Báo cáo flow, navigated=${navigated} URL=${page.url()}`)
    await snapshotForce(page, 'B1_reports_landing')

    // 2) For each of the 4 reports we ultimately want, find a matching link or
    // menu item by its Vietnamese label and click it; snapshot the landing
    // page so we can read its URL + DOM out of the artifact.
    //
    // Vietnamese labels are best-effort guesses — they're what an iPOS Fabi
    // restaurant operator would normally read in the menu. If a label miss,
    // we'll see "no match" in the log and the artifacts will still contain
    // B1_reports_landing for inspection.
    const targets: Array<{ key: string; labels: string[] }> = [
      { key: 'sale_summary',    labels: ['Tổng quan doanh thu', 'Tổng quan', 'Doanh thu theo ngày'] },
      { key: 'payment_methods', labels: ['Phương thức thanh toán', 'Phương thức TT', 'Hình thức thanh toán'] },
      { key: 'items',           labels: ['Bán hàng theo món', 'Báo cáo bán hàng theo món', 'Theo món', 'Bán hàng theo mặt hàng'] },
      { key: 'source',          labels: ['Nguồn đơn hàng', 'Theo nguồn', 'Đơn hàng theo nguồn'] },
    ]

    for (const t of targets) {
      let clicked = false
      for (const label of t.labels) {
        // Try generic clickable elements containing the exact text.
        const loc = page.locator(`a, button, .menu-item, .list-menu__item, li, div`).filter({ hasText: label }).first()
        if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
          await loc.click().catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
          await page.waitForTimeout(400)
          log.info(`after click "${label}" (${t.key}), URL: ${page.url()}`)
          await snapshotForce(page, `B2_${t.key}_landing`)
          clicked = true
          break
        }
      }
      if (!clicked) {
        log.warn(`no menu item matched any label for ${t.key}: ${t.labels.join(' | ')}`)
      }
    }
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
        await snapshotForce(this.requirePage(), `err_${key}`)
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

  private async setDateRange(page: Page, _start: string, _end: string, ctx: string): Promise<void> {
    // iPOS Fabi's date picker is preset-driven, not input-driven. Run
    // 25840989851 artifact showed clicking .reportrange-text opens a popup
    // with 5 preset rows (Hôm nay / Hôm qua / 7 ngày trước / Tháng này /
    // Tháng trước) plus two month calendars. No text inputs to fill.
    //
    // For now we click "Tháng trước" (Last Month) — that gives a full 30-day
    // window of finalized data. Once we have a working pipeline end-to-end
    // we can extend this to click arbitrary date cells for true 30-day
    // rolling windows. IPOS_DAYS env is currently ignored (TODO).
    const toggle = page.locator('.reportrange-text').first()
    if (await toggle.count() === 0 || !(await toggle.isVisible().catch(() => false))) {
      log.warn(`could not find .reportrange-text toggle for ${ctx} — leaving default range`)
      await snapshotForce(page, `dp_no_toggle_${ctx}`)
      return
    }
    await toggle.click().catch(() => {})
    await page.waitForTimeout(500)
    await snapshotForce(page, `dp_open_${ctx}`)

    // Click the "Tháng trước" preset. The preset row is a clickable element
    // inside the popup that's a sibling of the calendar grid.
    const preset = page.locator('li, div, button, a').filter({ hasText: /^\s*Tháng trước\s*$/ }).first()
    if (await preset.count() === 0 || !(await preset.isVisible().catch(() => false))) {
      log.warn(`no "Tháng trước" preset found for ${ctx}`)
      await snapshotForce(page, `dp_no_preset_${ctx}`)
      return
    }
    await preset.click().catch((e) => log.warn(`click "Tháng trước" failed: ${e instanceof Error ? e.message : e}`))
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(800)
    await snapshotForce(page, `dp_after_preset_${ctx}`)
    log.info(`applied "Tháng trước" preset on ${ctx}`)
  }

  private formatDateForIpos(iso: string): string {
    // iPOS Vietnam usually shows DD/MM/YYYY in date inputs.
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  private async clickExport(page: Page, ctx: string): Promise<Download> {
    // Two-step: open the "Xuất báo cáo" dropdown, then click the FIRST item
    // ("Xuất báo cáo theo cửa hàng đã chọn" — export for selected store).
    // Confirmed via run 25840645493 artifact:
    //
    //   <button aria-haspopup="menu" class="btn dropdown-toggle btn-outline-blue ...">
    //     Xuất báo cáo
    //     <i class="fal fa-download"></i>
    //   </button>
    //   <ul role="menu" class="dropdown-menu ...">
    //     <li><a class="dropdown-item">Xuất báo cáo theo cửa hàng đã chọn</a></li>
    //     <li><a class="dropdown-item">Xuất báo cáo tất cả cửa hàng</a></li>
    //     <li><a class="dropdown-item">Xuất báo cáo so sánh ...</a></li>
    //     <li><a class="dropdown-item">Xuất báo cáo so sánh ...</a></li>
    //   </ul>
    const toggle = page.locator('button.dropdown-toggle', { hasText: 'Xuất báo cáo' }).first()
    if (await toggle.count() === 0 || !(await toggle.isVisible().catch(() => false))) {
      await snapshotForce(page, `no_export_toggle_${ctx}`)
      throw new Error(`No "Xuất báo cáo" dropdown toggle found for ${ctx}`)
    }
    await toggle.click()
    await page.waitForTimeout(400) // let dropdown render
    await snapshotForce(page, `dropdown_open_${ctx}`)

    // First option = export the currently selected store's data, which is
    // what we want (single-store backend, single-store scrape).
    const firstOption = page.locator('a.dropdown-item:has-text("Xuất báo cáo theo cửa hàng đã chọn")').first()
    if (await firstOption.count() === 0 || !(await firstOption.isVisible().catch(() => false))) {
      // Fall back: any dropdown-item that doesn't include "so sánh" (compare).
      const fallback = page.locator('ul.dropdown-menu.show a.dropdown-item').filter({ hasNotText: 'so sánh' }).first()
      if (await fallback.count() === 0) {
        await snapshotForce(page, `no_dropdown_item_${ctx}`)
        throw new Error(`No "Xuất báo cáo theo cửa hàng đã chọn" item found for ${ctx}`)
      }
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90_000 }),
        fallback.click(),
      ])
      return download
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      firstOption.click(),
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
    // Use waitFor with a per-selector timeout rather than instantaneous
    // isVisible() — Vue SPAs like fabi.ipos.vn mount the form structure across
    // multiple microtask ticks, so the input may exist in DOM during the probe
    // but report isVisible=false because its bounding box isn't laid out yet.
    // waitFor auto-polls the visibility state and gives the page enough time
    // to settle. We split the total budget across selectors so a missing
    // primary doesn't eat the entire timeout.
    const perSelectorMs = Math.max(1500, Math.floor(DEFAULT_TIMEOUT / selectors.length))
    for (const sel of selectors) {
      const loc = page.locator(sel).first()
      try {
        await loc.waitFor({ state: 'visible', timeout: perSelectorMs })
        return loc
      } catch {
        // Fall through to next selector.
      }
    }
    // Force the snapshot — we need DOM evidence to figure out the right selector,
    // and this is exactly the failure mode we keep hitting on first contact with
    // a new SPA. Without forcing, CI runs are useless for selector discovery.
    await snapshotForce(page, `missing_${description.replace(/\s+/g, '_')}`)
    throw new Error(`Could not find visible ${description}. Tried: ${selectors.join(', ')}`)
  }
}
