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

  // Go to dashboard first
  await page.goto(`${base}/dashboard?${params}`, { waitUntil: 'networkidle', timeout: 30000 })
  
  // Click Reporting to expand
  await page.click('text=Reporting')
  await page.waitForTimeout(1000)
  
  // Click Sales Summary
  await page.click('text=Sales Summary')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'debug_eat365_sales_summary.png', fullPage: true })
  console.log('Sales Summary URL:', page.url())

  // Find date inputs and export buttons
  const inputs = await page.locator('input').evaluateAll(els => els.map(e => ({ type: e.getAttribute('type'), name: e.getAttribute('name'), id: e.id, placeholder: e.getAttribute('placeholder'), value: e.getAttribute('value'), class: e.className })))
  console.log('Inputs:', JSON.stringify(inputs.filter(i => i.type === 'date' || i.type === 'text' || i.placeholder?.includes('date') || i.placeholder?.includes('Date')), null, 2))
  
  const exportBtns = await page.locator('button, a, div').evaluateAll(els => 
    els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 40), class: e.className }))
      .filter(e => e.text && (e.text.includes('Export') || e.text.includes('Download') || e.text.includes('匯出') || e.text.includes('下載') || e.text.includes('CSV') || e.text.includes('Excel')))
  )
  console.log('Export buttons:', JSON.stringify(exportBtns, null, 2))

  await browser.close()
}
main().catch(console.error)
