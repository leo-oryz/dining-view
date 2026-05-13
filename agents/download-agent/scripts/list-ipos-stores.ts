// Quick pre-flight: list stores that have iPOS creds, without revealing the password.
import { getServiceClient, loadStoresWithIposCreds } from '../lib/supabase'
import { ENV } from '../lib/env'

async function main() {
  const sb = getServiceClient()
  const stores = await loadStoresWithIposCreds(sb, ENV.IPOS_STORE_ID)
  if (stores.length === 0) {
    console.log('No stores have iPOS credentials.')
    process.exit(2)
  }
  for (const s of stores) {
    console.log(`  ${s.name} (${s.id})`)
    console.log(`    email: ${s.ipos_email}`)
    console.log(`    password: ${'•'.repeat(Math.min(s.ipos_password.length, 8))} (${s.ipos_password.length} chars)`)
    if (s.ipos_brand_uid) console.log(`    brand_uid: ${s.ipos_brand_uid}`)
    if (s.ipos_company_uid) console.log(`    company_uid: ${s.ipos_company_uid}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
