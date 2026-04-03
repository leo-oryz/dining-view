import 'dotenv/config'
import { downloadEat365Reports } from './eat365'
import { downloadOcardReports } from './ocard'
import { uploadFile } from './uploader'

interface StoreConfig {
  id: string
  name: string
  is_active: boolean
  credentials: {
    eat365?: { email: string; password: string }
    ocard?: { email: string; password: string }
  }
}

async function fetchStoreConfigs(): Promise<StoreConfig[]> {
  const baseUrl = process.env.AGENT_UPLOAD_BASE_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/stores`)
    const json = await res.json()
    if (!json.success || !json.data) return []
    return json.data
      .filter((s: { is_active: boolean }) => s.is_active)
      .map((s: { id: string; name: string; is_active: boolean; credentials?: StoreConfig['credentials'] }) => ({
        id: s.id,
        name: s.name,
        is_active: s.is_active,
        credentials: s.credentials || {},
      }))
  } catch (err) {
    console.warn('[agent] Failed to fetch store configs, falling back to default store')
    return []
  }
}

async function runForStore(store: StoreConfig, isDryRun: boolean, targetDate?: string) {
  console.log(`\n[agent] === Processing store: ${store.name} (${store.id})${targetDate ? ` date=${targetDate}` : ''} ===`)
  const allFiles = []
  const errors: string[] = []

  // Download eat365 reports
  const eat365Creds = store.credentials.eat365
  const hasEat365 = eat365Creds?.email || process.env.EAT365_LOGIN_EMAIL
  if (hasEat365) {
    try {
      console.log(`[agent] [${store.name}] Downloading eat365 reports...`)
      const eat365Files = await downloadEat365Reports({
        storeId: store.id,
        credentials: eat365Creds,
        targetDate,
      })
      allFiles.push(...eat365Files)
      console.log(`[agent] [${store.name}] eat365: ${eat365Files.length} files downloaded`)
    } catch (err: any) {
      const msg = `[agent] [${store.name}] eat365 download failed: ${err.message}`
      console.error(msg)
      errors.push(msg)
    }
  } else {
    console.log(`[agent] [${store.name}] Skipping eat365 (no credentials)`)
  }

  // Download Ocard reports
  const ocardCreds = store.credentials.ocard
  const hasOcard = ocardCreds?.email || process.env.OCARD_LOGIN_EMAIL
  if (hasOcard) {
    try {
      console.log(`[agent] [${store.name}] Downloading Ocard reports...`)
      const ocardFiles = await downloadOcardReports({
        storeId: store.id,
        credentials: ocardCreds,
        targetDate,
      })
      allFiles.push(...ocardFiles)
      console.log(`[agent] [${store.name}] Ocard: ${ocardFiles.length} files downloaded`)
    } catch (err: any) {
      const msg = `[agent] [${store.name}] Ocard download failed: ${err.message}`
      console.error(msg)
      errors.push(msg)
    }
  } else {
    console.log(`[agent] [${store.name}] Skipping Ocard (no credentials)`)
  }

  // Upload all files to API
  if (!isDryRun) {
    console.log(`[agent] [${store.name}] Uploading ${allFiles.length} files...`)
    for (const file of allFiles) {
      const result = await uploadFile(file.reportType, file.filePath, file.storeId)
      if (!result.success) {
        const msg = `[agent] [${store.name}] Upload failed for ${file.reportType}: ${result.error}`
        console.error(msg)
        errors.push(msg)
      }
    }
  } else {
    console.log(`[agent] [${store.name}] DRY RUN — skipping uploads`)
  }

  return { files: allFiles.length, errors }
}

async function run() {
  const isDryRun = process.env.DRY_RUN === 'true'
  console.log(`[agent] Starting download agent${isDryRun ? ' (DRY RUN)' : ''}`)
  console.log(`[agent] Date: ${new Date().toISOString()}`)

  // Fetch all store configs from API
  let stores = await fetchStoreConfigs()

  // Fallback: if no stores from API, use default with env credentials
  if (stores.length === 0) {
    stores = [{
      id: '36d016c4-7584-4c0f-a3e8-9562089d57f8',
      name: 'BE& 西門',
      credentials: {},
    }]
  }

  console.log(`[agent] Processing ${stores.length} store(s)`)

  let totalFiles = 0
  const allErrors: string[] = []

  // Support single date via CLI arg: npx tsx index.ts 2026-04-02
  const targetDate = process.argv[2] || undefined

  for (const store of stores) {
    const result = await runForStore(store, isDryRun, targetDate)
    totalFiles += result.files
    allErrors.push(...result.errors)
  }

  // Summary
  console.log('\n[agent] === Summary ===')
  console.log(`[agent] Stores processed: ${stores.length}`)
  console.log(`[agent] Files downloaded: ${totalFiles}`)
  console.log(`[agent] Errors: ${allErrors.length}`)
  if (allErrors.length > 0) {
    allErrors.forEach((e) => console.error(e))
  }
  console.log('[agent] Done.')
}

run().catch((err) => {
  console.error('[agent] Fatal error:', err)
  process.exit(1)
})
