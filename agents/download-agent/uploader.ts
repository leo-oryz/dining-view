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
  'ocard-dashboard': '/api/upload/ocard-dashboard',
  'ocard-recruit': '/api/upload/ocard-recruit',
  'ocard-consumption': '/api/upload/ocard-consumption',
  'ocard-rfm': '/api/upload/ocard-rfm',
  'ocard-members': '/api/upload/ocard-members',
}

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

    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer]), fileName)
    if (storeId) {
      formData.append('store_id', storeId)
    }
    if (date) {
      formData.append('date', date)
    }

    const url = `${baseUrl}${endpoint}`
    console.log(`[upload] POST ${url} (${fileName})`)

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    })

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
