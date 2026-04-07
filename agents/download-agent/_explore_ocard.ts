import 'dotenv/config'
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  await page.goto('https://crm.ocard.co/Login', { waitUntil: 'networkidle' })
  await page.fill('input[name="acc"]', process.env.OCARD_LOGIN_EMAIL!)
  await page.fill('input[name="pwd"]', process.env.OCARD_LOGIN_PASSWORD!)
  await page.click('button:has-text("登入")')
  await page.waitForTimeout(5000)
  console.log('Ocard URL after login:', page.url())
  
  // Screenshot the full page
  await page.screenshot({ path: 'debug_ocard_nav.png', fullPage: true })
  
  // Get sidebar/nav structure
  const navItems = await page.locator('a, button, [role="menuitem"], .menu-item, .nav-item, span.name').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 50), href: (e as HTMLAnchorElement).href || '', class: e.className })).filter(e => e.text && e.text.length > 0 && e.text.length < 50)
  )
  console.log('Nav items:', JSON.stringify(navItems.slice(0, 40), null, 2))
  
  await browser.close()
}
main().catch(console.error)
