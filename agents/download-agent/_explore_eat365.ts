import { chromium } from 'playwright'
import fs from 'fs'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    storageState: 'eat365-session.json',
    viewport: { width: 1280, height: 900 }
  })
  const page = await context.newPage()

  // Go to the main page (should be logged in via session)
  await page.goto('https://mpphk.eats365pos.com/v2/?u=0&restaurantCode=TWTP001206&organizationUID=114791&brandUID=117072', { waitUntil: 'networkidle', timeout: 30000 })
  console.log('URL:', page.url())

  // Click Reporting
  await page.click('text=Reporting')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'debug_eat365_reporting.png', fullPage: true })

  // Get all sub-menu items
  const menuItems = await page.locator('.sidebar-menu a, .nav-link, .menu-item, li a').evaluateAll(els => 
    els.map(e => ({ text: e.textContent?.trim().slice(0, 60), href: e.getAttribute('href') })).filter(e => e.text)
  )
  console.log('Menu items:', JSON.stringify(menuItems.slice(0, 30), null, 2))

  await browser.close()
}
main().catch(console.error)
