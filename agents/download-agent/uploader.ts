import fs from 'fs'
import path from 'path'

type UploadResult = {
  reportType: string
  success: boolean
  error?: string
}

const REPORT_ENDPOINTS: Record<string, string> = {
  'eat365-summary': '/api/upload/eat365-summary',
  'eat365-hourly': '/api/upload/eat365-hourly',
  'eat365-items': '/api/upload/eat365-items',
  'eat365-transactions': '/api/upload/eat365-transactions',
  'eat365-daily-closing': '/api/upload/eat365-daily-closing',
  'ocard-dashboard': '/api/upload/ocard-dashboard',
  'ocard-recruit': '/api/upload/ocard-recruit',
  'ocard-consumption': '/api/upload/ocard-consumption',
  'ocard-rfm': '/api/upload/ocard-rfm',
  'ocard-members': '/api/upload/ocard-members',
}

const JSON_BODY_REPORTS = new Set(['eat365-daily-closing'])

export async function uploadFile(
  reportType: string,
  filePath: string,
  storeId?: string,
  date?: string
): Promise<UploadResult> {
  const baseUrl = process.env.AGENT_UPLOAD_BASE_URL
  if (!baseUrl) {
    return { reportType, success: false, error: 'AGENT_UPLOAD_BASE_URL not set' }
  }

  const endpoint = REPORT_ENDPOINTS[reportType]
  if (!endpoint) {
    return { reportType, success: false, error: `Unknown report type: ${reportType}` }
  }

  try {
    const fileBuffer = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)
    const url = `${baseUrl}${endpoint}`
    console.log(`[upload] POST ${url} (${fileName})`)

    let res: Response
    if (JSON_BODY_REPORTS.has(reportType)) {
      // Daily-closing payloads are JSON; the file on disk is already the
      // { date, json } wrapper expected by the upload endpoint.
      const body = fileBuffer.toString('utf-8')
      const parsed = JSON.parse(body) as { date?: string; json?: unknown }
      const wrapped = {
        store_id: storeId,
        date: parsed.date || date,
        json: parsed.json,
      }
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(wrapped),
      })
    } else {
      const formData = new FormData()
      formData.append('file', new Blob([fileBuffer]), fileName)
      if (storeId) formData.append('store_id', storeId)
      if (date) formData.append('date', date)
      res = await fetch(url, { method: 'POST', body: formData })
    }

    const json = await res.json()

    if (!json.success) {
      return { reportType, success: false, error: json.error || 'Upload failed' }
    }

    console.log(`[upload] ${reportType}: success`)
    return { reportType, success: true }
  } catch (err: any) {
    return { reportType, success: false, error: err.message }
  }
}
