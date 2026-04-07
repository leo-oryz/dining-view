import 'dotenv/config'
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  // Login
  await page.goto('https://crm.ocard.co/Login', { waitUntil: 'networkidle' })
  await page.fill('input[name="acc"]', process.env.OCARD_LOGIN_EMAIL!)
  await page.fill('input[name="pwd"]', process.env.OCARD_LOGIN_PASSWORD!)
  await page.click('button:has-text("登入")')
  await page.waitForTimeout(5000)

  // Go to Dashboard directly
  await page.goto('https://crm.ocard.co/Dashboard', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'debug_ocard_dashboard.png', fullPage: true })
  console.log('Dashboard URL:', page.url())

  // Find export/download elements
  const exportBtns = await page.locator('button, a, div, span').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 40), class: e.className, href: (e as HTMLAnchorElement).href || '' }))
      .filter(e => e.text && (e.text.includes('匯出') || e.text.includes('下載') || e.text.includes('Export') || e.text.includes('Download') || e.text.includes('CSV') || e.text.includes('Excel')))
  )
  console.log('Export elements:', JSON.stringify(exportBtns, null, 2))

  // Find date inputs
  const dateEls = await page.locator('input[type="date"], input[type="text"], .date-picker, [class*="date"]').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, type: e.getAttribute('type'), name: e.getAttribute('name'), class: e.className, placeholder: e.getAttribute('placeholder'), value: (e as HTMLInputElement).value }))
  )
  console.log('Date elements:', JSON.stringify(dateEls.slice(0, 10), null, 2))

  await browser.close()
}
main().catch(console.error)
