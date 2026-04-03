import { google } from 'googleapis'

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error('Google service account credentials not configured')
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
}

export type GscRow = {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  date: string
}

/**
 * Fetch GSC brand search data.
 * GSC has 2-3 day lag — always fetch date <= TODAY - 3.
 */
export async function fetchBrandSearch(
  startDate: string,
  endDate: string,
): Promise<GscRow[]> {
  const siteUrl = process.env.GSC_SITE_URL
  if (!siteUrl) throw new Error('GSC_SITE_URL not configured')

  const auth = getAuth()
  const searchconsole = google.searchconsole({ version: 'v1', auth })

  const rows: GscRow[] = []

  // Exponential backoff retry
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query', 'date'],
          rowLimit: 25000,
        },
      })

      if (res.data.rows) {
        for (const row of res.data.rows) {
          rows.push({
            query: row.keys![1] ? row.keys![0] : row.keys![0],
            date: row.keys![1] || row.keys![0],
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
          })
        }
      }
      return rows
    } catch (err: unknown) {
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }

  return rows
}
