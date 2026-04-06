import 'dotenv/config'
import { downloadEat365Reports } from './eat365'
import { downloadOcardReports } from './ocard'
import { uploadFile } from './uploader'

const DEFAULT_STORE_ID = '36d016c4-7584-4c0f-a3e8-9562089d57f8'

function getLastWeekRange(): { start: string; end: string } {
  const now = new Date()
  // Last Sunday (yesterday if today is Monday)
  const end = new Date(now)
  end.setDate(end.getDate() - 1)
  // Last Monday (7 days before end's day, which is the Sunday)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

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

async function weekly() {
  const { start, end } = getLastWeekRange()
  const dates = getDateRange(start, end)

  console.log(`[weekly] Fetching last week: ${start} → ${end} (${dates.length} days)`)

  let totalDownloaded = 0
  let totalUploaded = 0
  let totalErrors = 0

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    console.log(`\n[weekly] === ${date} (${i + 1}/${dates.length}) ===`)

    const allFiles = []

    // eat365
    try {
      const files = await downloadEat365Reports({ storeId: DEFAULT_STORE_ID, targetDate: date })
      allFiles.push(...files)
      console.log(`[weekly] eat365: ${files.length} files`)
    } catch (err: any) {
      console.error(`[weekly] eat365 failed for ${date}: ${err.message}`)
      totalErrors++
    }

    // Ocard
    try {
      const files = await downloadOcardReports({ storeId: DEFAULT_STORE_ID, targetDate: date })
      allFiles.push(...files)
      console.log(`[weekly] ocard: ${files.length} files`)
    } catch (err: any) {
      console.error(`[weekly] ocard failed for ${date}: ${err.message}`)
      totalErrors++
    }

    totalDownloaded += allFiles.length

    // Upload
    for (const file of allFiles) {
      const result = await uploadFile(file.reportType, file.filePath, file.storeId, file.date)
      if (result.success) {
        totalUploaded++
      } else {
        console.error(`[weekly] Upload failed ${file.reportType} ${date}: ${result.error}`)
        totalErrors++
      }
    }

    if (i < dates.length - 1) await sleep(3000)
  }

  console.log('\n[weekly] ========== SUMMARY ==========')
  console.log(`[weekly] Range: ${start} → ${end}`)
  console.log(`[weekly] Files downloaded: ${totalDownloaded}`)
  console.log(`[weekly] Files uploaded: ${totalUploaded}`)
  console.log(`[weekly] Errors: ${totalErrors}`)
  console.log('[weekly] Done.')
}

weekly().catch((err) => {
  console.error('[weekly] Fatal error:', err)
  process.exit(1)
})
