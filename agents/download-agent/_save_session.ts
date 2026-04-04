import 'dotenv/config'
import { chromium } from 'playwright'
import fs from 'fs'

async function main() {
  console.log('[session] Launching visible browser — please complete MFA when prompted...')
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  await page.goto('https://mpphk.eats365pos.com/sign-in', { waitUntil: 'networkidle' })
  await page.fill('#username', process.env.EAT365_LOGIN_EMAIL!)
  await page.fill('#password', process.env.EAT365_LOGIN_PASSWORD!)
  await page.click('div.sign-in-btn')

  console.log('[session] Waiting for you to complete MFA verification...')
  await page.waitForURL((url) => !url.toString().includes('/sign-in'), { timeout: 300000 })
  console.log('[session] Login successful! URL:', page.url())

  const state = await context.storageState()
  fs.writeFileSync('eat365-session.json', JSON.stringify(state, null, 2))
  console.log('[session] Session saved to eat365-session.json')

  await browser.close()
  console.log('[session] Done!')
}
main().catch(console.error)
