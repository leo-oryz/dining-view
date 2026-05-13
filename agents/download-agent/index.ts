import { ENV } from './lib/env'
import { log } from './lib/log'
import { getServiceClient, loadStoresWithIposCreds, type StoreCreds } from './lib/supabase'
import { IposScraper } from './lib/ipos-scraper'
import { ingestIposDownload, type IngestReport } from './lib/ingest'

async function runForStore(store: StoreCreds): Promise<IngestReport | { error: string; storeId: string }> {
  log.info(`════ store: ${store.name} (${store.id}) — last ${ENV.IPOS_DAYS} days ════`)
  const scraper = new IposScraper({
    email: store.ipos_email,
    password: store.ipos_password,
    brand_uid: store.ipos_brand_uid,
    company_uid: store.ipos_company_uid,
  })
  try {
    await scraper.start()
    await scraper.login()
    await scraper.selectBrandIfNeeded()
    const files = await scraper.downloadAllReports()
    const supabase = getServiceClient()
    const report = await ingestIposDownload(supabase, store.id, files)
    return report
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.err(`scrape failed for store ${store.id}: ${msg}`)
    return { error: msg, storeId: store.id }
  } finally {
    await scraper.stop()
  }
}

async function main() {
  const supabase = getServiceClient()
  const stores = await loadStoresWithIposCreds(supabase, ENV.IPOS_STORE_ID)
  if (stores.length === 0) {
    log.warn(`No stores have iPOS credentials configured${ENV.IPOS_STORE_ID ? ` (store_id filter: ${ENV.IPOS_STORE_ID})` : ''}. Fill them in Settings → Store → iPOS Email/Password.`)
    process.exit(2)
  }
  log.info(`Found ${stores.length} store(s) to scrape: ${stores.map(s => s.name).join(', ')}`)

  const results: Array<IngestReport | { error: string; storeId: string }> = []
  for (const store of stores) {
    const r = await runForStore(store)
    results.push(r)
  }

  log.info('════ summary ════')
  let failed = 0
  for (const r of results) {
    if ('error' in r) {
      log.err(`  store ${r.storeId}: FAILED — ${r.error}`)
      failed++
    } else {
      log.info(`  store ${r.storeId}: daily=${r.written.daily} hourly=${r.written.hourly} products=${r.written.products} parseErr=${r.parseErrors.length} writeErr=${r.writeErrors.length}`)
      if (r.parseErrors.length > 0) log.warn(`    parse errors: ${r.parseErrors.join(' | ')}`)
      if (r.writeErrors.length > 0) log.warn(`    write errors: ${r.writeErrors.join(' | ')}`)
    }
  }
  if (failed > 0) {
    log.err(`${failed}/${results.length} store(s) failed`)
    process.exit(1)
  }
}

main().catch(err => {
  log.err('fatal:', err)
  process.exit(1)
})
