import 'dotenv/config'
import { chromium } from 'playwright'

async function debugEat365() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('https://mpphk.eats365pos.com/sign-in', { waitUntil: 'networkidle' })
  await page.fill('#username', process.env.EAT365_LOGIN_EMAIL!)
  await page.fill('#password', process.env.EAT365_LOGIN_PASSWORD!)
  await page.click('div.sign-in-btn')
  // Wait for URL change or content change instead of navigation
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'debug_eat365_after_login.png', fullPage: true })
  console.log('eat365 URL after login:', page.url())
  // Check if there's MFA
  const mfaVisible = await page.locator('#otp-request-form, .pc-box').isVisible().catch(() => false)
  console.log('eat365 MFA visible:', mfaVisible)
  await browser.close()
}

async function debugOcard() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('https://crm.ocard.co/Login', { waitUntil: 'networkidle' })
  await page.fill('input[name="acc"]', process.env.OCARD_LOGIN_EMAIL!)
  await page.fill('input[name="pwd"]', process.env.OCARD_LOGIN_PASSWORD!)
  await page.click('button:has-text("登入")')
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'debug_ocard_after_login.png', fullPage: true })
  console.log('Ocard URL after login:', page.url())
  await browser.close()
}

Promise.all([debugEat365(), debugOcard()]).catch(console.error)
