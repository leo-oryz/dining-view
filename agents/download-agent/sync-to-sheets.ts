/**
 * Sync eat365 Transaction Report CSV to Google Sheets.
 *
 * Usage:
 *   npx tsx sync-to-sheets.ts <csv-file>
 *   npx tsx sync-to-sheets.ts                    # auto-detect latest CSV in ~/Downloads
 *
 * The eat365 Transaction Report page is protected by Cloudflare Turnstile
 * which blocks automated browsers. This script handles the Google Sheets
 * sync after you manually download the CSV from eat365.
 *
 * Steps:
 *   1. Go to eat365 Merchant Portal → Reporting → Transaction Report
 *   2. Set date range → Submit → click "..." → Export CSV
 *   3. Run this script (it will find the latest CSV in ~/Downloads)
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { syncTransactionsToSheet } from './google-sheets'
import { parseTransactionCsv } from './parse-transaction-csv'

async function findLatestTransactionCsv(): Promise<string | null> {
  const downloadsDir = path.join(os.homedir(), 'Downloads')
  if (!fs.existsSync(downloadsDir)) return null

  const files = fs.readdirSync(downloadsDir)
    .filter((f) => /transaction/i.test(f) && /\.(csv|xlsx?)$/i.test(f))
    .map((f) => ({
      name: f,
      path: path.join(downloadsDir, f),
      mtime: fs.statSync(path.join(downloadsDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  return files[0]?.path || null
}

async function run() {
  let csvPath = process.argv[2]

  if (!csvPath) {
    console.log('[sync] No file specified, looking for latest Transaction Report CSV in ~/Downloads...')
    csvPath = await findLatestTransactionCsv() || ''
    if (!csvPath) {
      console.error('[sync] No Transaction Report CSV found in ~/Downloads.')
      console.error('[sync] Usage: npx tsx sync-to-sheets.ts <path-to-csv>')
      process.exit(1)
    }
    console.log(`[sync] Found: ${csvPath}`)
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`[sync] File not found: ${csvPath}`)
    process.exit(1)
  }

  // Read and parse the CSV
  console.log(`[sync] Reading ${path.basename(csvPath)}...`)
  const csvText = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseTransactionCsv(csvText)

  if (rows.length === 0) {
    console.error('[sync] No valid transaction rows found in CSV.')
    console.error('[sync] Make sure this is an eat365 Transaction Report export.')
    process.exit(1)
  }

  console.log(`[sync] Parsed ${rows.length} transaction rows`)
  console.log(`[sync] Sample: Serial#${rows[0].serialNumber} ${rows[0].tender} $${rows[0].orderTotal} ${rows[0].customerPhone}`)

  // Sync to Google Sheets
  const result = await syncTransactionsToSheet(rows)
  console.log(`[sync] Done! Appended: ${result.appended}, Skipped (duplicates): ${result.skipped}`)
}

run().catch((err) => {
  console.error('[sync] Fatal error:', err.message)
  process.exit(1)
})
