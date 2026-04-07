import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    storageState: 'eat365-session.json',
    viewport: { width: 1280, height: 900 }
  })
  const page = await context.newPage()
  const base = 'https://mpphk.eats365pos.com/v2'
  const params = 'restaurantCode=TWTP001206&u=0&organizationUID=114791&brandUID=117072'

  // Sales Summary page
  await page.goto(`${base}/report/sales_summary?${params}`, { waitUntil: 'networkidle', timeout: 30000 })

  // Set date to yesterday and click search/apply
  await page.fill('input.start-date', '2026-04-02 00:00')
  await page.fill('input.end-date', '2026-04-02 23:59')
  
  // Look for Apply/Search/Generate buttons
  const allBtns = await page.locator('button').evaluateAll(els => 
    els.map(e => ({ text: e.textContent?.trim().slice(0, 50), class: e.className, id: e.id, type: e.getAttribute('type') }))
  )
  console.log('All buttons:', JSON.stringify(allBtns, null, 2))

  // Try clicking search/apply
  const searchBtn = page.locator('button:has-text("Search"), button:has-text("Apply"), button:has-text("查詢"), button:has-text("Generate"), button.btn-primary')
  if (await searchBtn.count() > 0) {
    await searchBtn.first().click()
    await page.waitForTimeout(5000)
  }
  
  await page.screenshot({ path: 'debug_eat365_after_search.png', fullPage: true })
  
  // Look for export/download after data loads
  const allElements = await page.locator('button, a, [role="button"]').evaluateAll(els =>
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 50), class: e.className }))
      .filter(e => e.text && (e.text.includes('Export') || e.text.includes('Download') || e.text.includes('匯出') || e.text.includes('下載') || e.text.includes('CSV') || e.text.includes('Excel') || e.text.includes('Print') || e.text.includes('pdf')))
  )
  console.log('After search - export elements:', JSON.stringify(allElements, null, 2))
  
  // Also try scrolling down to see if there's more
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'debug_eat365_scrolled.png', fullPage: true })

  await browser.close()
}
main().catch(console.error)
