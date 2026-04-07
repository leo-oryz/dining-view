import { chromium } from 'playwright'
async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('https://mpphk.eats365pos.com/sign-in', { waitUntil: 'networkidle' })
  // Check for any clickable submit elements (a, div, span with click handlers)
  const allClickable = await page.locator('[type="submit"], [role="button"], .btn, .submit, a.sign-in, div[class*="sign"], div[class*="login"], div[class*="btn"]').evaluateAll(els => els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 50), class: e.className, id: e.id })))
  console.log('CLICKABLE:', JSON.stringify(allClickable, null, 2))
  // Also check form
  const forms = await page.locator('form').evaluateAll(els => els.map(e => ({ action: e.getAttribute('action'), method: e.getAttribute('method'), id: e.id, class: e.className })))
  console.log('FORMS:', JSON.stringify(forms, null, 2))
  await browser.close()
}
main().catch(console.error)
