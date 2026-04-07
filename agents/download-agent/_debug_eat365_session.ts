import { chromium } from 'playwright'

async function main() {
  // Try to launch with the user's Chrome profile to reuse their session
  const browser = await chromium.launchPersistentContext(
    '/Users/macbook/Library/Application Support/Google/Chrome/Default',
    { headless: true, viewport: { width: 1280, height: 900 }, channel: 'chrome' }
  )
  const page = await browser.newPage()
  await page.goto('https://mpphk.eats365pos.com/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.screenshot({ path: 'debug_eat365_chrome.png', fullPage: true })
  console.log('URL:', page.url())
  await browser.close()
}
main().catch(console.error)
