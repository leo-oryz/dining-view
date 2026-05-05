const CALENDARIFIC_BASE = 'https://calendarific.com/api/v2'

export interface CalendarificHoliday {
  name: string
  description?: string
  date: { iso: string }
  type: string[]
  primary_type?: string
  locations?: string
  states?: string
}

interface CalendarificResponse {
  response?: {
    holidays?: CalendarificHoliday[]
  }
  meta?: {
    code?: number
    error_type?: string
    error_detail?: string
  }
}

export async function fetchHolidays(params: {
  countryCode: string
  year: number
}): Promise<CalendarificHoliday[]> {
  const apiKey = process.env.CALENDARIFIC_API_KEY
  if (!apiKey) return []

  const url = new URL(`${CALENDARIFIC_BASE}/holidays`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('country', params.countryCode)
  url.searchParams.set('year', String(params.year))

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) {
    throw new Error(`Calendarific API error: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as CalendarificResponse
  if (data.meta?.code && data.meta.code !== 200) {
    throw new Error(
      `Calendarific API error: ${data.meta.error_type ?? data.meta.code} ${data.meta.error_detail ?? ''}`,
    )
  }
  return data.response?.holidays ?? []
}
