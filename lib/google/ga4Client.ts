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
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
}

export type Ga4Row = {
  date: string
  event_name: string
  event_count: number
  user_count: number
  new_users: number
  sessions: number
  page_path: string | null
  source: string | null
  medium: string | null
}

/**
 * Fetch GA4 event data.
 * GA4 has 1-day lag — always fetch date <= TODAY - 1.
 */
export async function fetchEvents(
  startDate: string,
  endDate: string,
  eventNames?: string[]
): Promise<Ga4Row[]> {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) throw new Error('GA4_PROPERTY_ID not configured')

  const auth = getAuth()
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth })

  const dimensionFilter = eventNames?.length
    ? {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: eventNames },
        },
      }
    : undefined

  const rows: Ga4Row[] = []

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: 'date' },
            { name: 'eventName' },
            { name: 'pagePath' },
            { name: 'sessionSource' },
            { name: 'sessionMedium' },
          ],
          metrics: [
            { name: 'eventCount' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'sessions' },
          ],
          dimensionFilter,
          limit: '100000',
        },
      })

      if (res.data.rows) {
        for (const row of res.data.rows) {
          const dims = row.dimensionValues || []
          const mets = row.metricValues || []
          const dateRaw = dims[0]?.value || ''
          const formattedDate = dateRaw.length === 8
            ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
            : dateRaw

          rows.push({
            date: formattedDate,
            event_name: dims[1]?.value || '',
            page_path: dims[2]?.value || null,
            source: dims[3]?.value || null,
            medium: dims[4]?.value || null,
            event_count: parseInt(mets[0]?.value || '0'),
            user_count: parseInt(mets[1]?.value || '0'),
            new_users: parseInt(mets[2]?.value || '0'),
            sessions: parseInt(mets[3]?.value || '0'),
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
