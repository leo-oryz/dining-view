import { chromium } from 'playwright'
async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('https://mpphk.eats365pos.com/sign-in', { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'screenshot_eat365.png', fullPage: true })
  const html = await page.content()
  // Extract form-related elements
  const inputs = await page.locator('input').evaluateAll(els => els.map(e => ({ type: e.getAttribute('type'), name: e.getAttribute('name'), id: e.id, placeholder: e.getAttribute('placeholder'), class: e.className })))
  const buttons = await page.locator('button').evaluateAll(els => els.map(e => ({ type: e.getAttribute('type'), text: e.textContent?.trim(), class: e.className })))
  console.log('INPUTS:', JSON.stringify(inputs, null, 2))
  console.log('BUTTONS:', JSON.stringify(buttons, null, 2))
  await browser.close()
}
main().catch(console.error)
