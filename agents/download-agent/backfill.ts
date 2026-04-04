import 'dotenv/config'
import { downloadEat365Reports } from './eat365'
import { downloadOcardReports } from './ocard'
import { uploadFile } from './uploader'

const DEFAULT_STORE_ID = '36d016c4-7584-4c0f-a3e8-9562089d57f8'

function getDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = []
  const start = new Date(startStr)
  const end = new Date(endStr)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function backfill() {
  const startDate = process.argv[2] || '2025-11-01'
  const endDate = process.argv[3] || new Date(Date.now() - 86400000).toISOString().slice(0, 10) // yesterday
  const skipEat365 = process.argv.includes('--skip-eat365')
  const skipOcard = process.argv.includes('--skip-ocard')
  const dryRun = process.argv.includes('--dry-run')

  const dates = getDateRange(startDate, endDate)
  console.log(`[backfill] Range: ${startDate} → ${endDate} (${dates.length} days)`)
  console.log(`[backfill] eat365: ${skipEat365 ? 'SKIP' : 'ON'}, ocard: ${skipOcard ? 'SKIP' : 'ON'}, dry-run: ${dryRun}`)

  let totalDownloaded = 0
  let totalUploaded = 0
  let totalErrors = 0
  const failedDates: string[] = []

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    console.log(`\n[backfill] === ${date} (${i + 1}/${dates.length}) ===`)

    const allFiles = []

    // eat365
    if (!skipEat365) {
      try {
        const files = await downloadEat365Reports({ storeId: DEFAULT_STORE_ID, targetDate: date })
        allFiles.push(...files)
        console.log(`[backfill] eat365: ${files.length} files`)
      } catch (err: any) {
        console.error(`[backfill] eat365 failed for ${date}: ${err.message}`)
        totalErrors++
      }
    }

    // Ocard
    if (!skipOcard) {
      try {
        const files = await downloadOcardReports({ storeId: DEFAULT_STORE_ID, targetDate: date })
        allFiles.push(...files)
        console.log(`[backfill] ocard: ${files.length} files`)
      } catch (err: any) {
        console.error(`[backfill] ocard failed for ${date}: ${err.message}`)
        totalErrors++
      }
    }

    totalDownloaded += allFiles.length

    // Upload
    if (!dryRun && allFiles.length > 0) {
      for (const file of allFiles) {
        const result = await uploadFile(file.reportType, file.filePath, file.storeId, file.date)
        if (result.success) {
          totalUploaded++
        } else {
          console.error(`[backfill] Upload failed ${file.reportType} ${date}: ${result.error}`)
          totalErrors++
        }
      }
    }

    if (allFiles.length === 0) {
      failedDates.push(date)
    }

    // Delay between days to avoid rate limiting (3s)
    if (i < dates.length - 1) {
      await sleep(3000)
    }
  }

  // Summary
  console.log('\n[backfill] ========== SUMMARY ==========')
  console.log(`[backfill] Days processed: ${dates.length}`)
  console.log(`[backfill] Files downloaded: ${totalDownloaded}`)
  console.log(`[backfill] Files uploaded: ${totalUploaded}`)
  console.log(`[backfill] Errors: ${totalErrors}`)
  if (failedDates.length > 0) {
    console.log(`[backfill] Failed dates (0 files): ${failedDates.join(', ')}`)
  }
  console.log('[backfill] Done.')
}

backfill().catch((err) => {
  console.error('[backfill] Fatal error:', err)
  process.exit(1)
})
