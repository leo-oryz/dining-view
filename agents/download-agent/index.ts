import 'dotenv/config'
import { downloadEat365Reports } from './eat365'
import { downloadOcardReports } from './ocard'
import { uploadFile } from './uploader'

async function run() {
  const isDryRun = process.env.DRY_RUN === 'true'
  console.log(`[agent] Starting download agent${isDryRun ? ' (DRY RUN)' : ''}`)
  console.log(`[agent] Date: ${new Date().toISOString()}`)

  const allFiles = []
  const errors: string[] = []

  // Download eat365 reports
  try {
    console.log('[agent] Downloading eat365 reports...')
    const eat365Files = await downloadEat365Reports()
    allFiles.push(...eat365Files)
    console.log(`[agent] eat365: ${eat365Files.length} files downloaded`)
  } catch (err: any) {
    const msg = `[agent] eat365 download failed: ${err.message}`
    console.error(msg)
    errors.push(msg)
  }

  // Download Ocard reports
  try {
    console.log('[agent] Downloading Ocard reports...')
    const ocardFiles = await downloadOcardReports()
    allFiles.push(...ocardFiles)
    console.log(`[agent] Ocard: ${ocardFiles.length} files downloaded`)
  } catch (err: any) {
    const msg = `[agent] Ocard download failed: ${err.message}`
    console.error(msg)
    errors.push(msg)
  }

  // Upload all files to API
  if (!isDryRun) {
    console.log(`[agent] Uploading ${allFiles.length} files...`)
    for (const file of allFiles) {
      const result = await uploadFile(file.reportType, file.filePath)
      if (!result.success) {
        const msg = `[agent] Upload failed for ${file.reportType}: ${result.error}`
        console.error(msg)
        errors.push(msg)
      }
    }
  } else {
    console.log('[agent] DRY RUN — skipping uploads')
  }

  // Summary
  console.log('\n[agent] === Summary ===')
  console.log(`[agent] Files downloaded: ${allFiles.length}`)
  console.log(`[agent] Errors: ${errors.length}`)
  if (errors.length > 0) {
    errors.forEach((e) => console.error(e))
  }
  console.log('[agent] Done.')
}

run().catch((err) => {
  console.error('[agent] Fatal error:', err)
  process.exit(1)
})
