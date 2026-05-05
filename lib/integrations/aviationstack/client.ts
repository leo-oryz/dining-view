// AviationStack free plan uses HTTP only — do not switch to HTTPS
// unless on a paid plan.
const AVIATIONSTACK_BASE = 'http://api.aviationstack.com/v1'

// Country code → AviationStack country name (the dep_country filter accepts
// either the ISO code or the full name depending on plan tier — verify
// against your account if results look empty).
export const ORIGIN_COUNTRY_NAMES: Record<string, string> = {
  CN: 'China',
  KR: 'South Korea',
  TH: 'Thailand',
  TW: 'Taiwan',
  SG: 'Singapore',
  HK: 'Hong Kong',
  MY: 'Malaysia',
  PH: 'Philippines',
}

export interface AviationStackFlight {
  flight_date: string
  flight_status: string
  departure: {
    airport: string
    country_name: string
    iata: string
  }
  arrival: {
    airport: string
    iata: string
  }
  flight: {
    number: string
  }
}

interface AviationStackResponse {
  pagination?: {
    limit: number
    offset: number
    count: number
    total: number
  }
  data?: AviationStackFlight[]
  error?: { code?: string; message?: string }
}

export async function fetchFlights(params: {
  arrivalAirport: string
  originCountry: string
  date: string
}): Promise<AviationStackFlight[]> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY
  if (!apiKey) return []

  const all: AviationStackFlight[] = []
  const limit = 100
  let offset = 0

  while (true) {
    const url = new URL(`${AVIATIONSTACK_BASE}/flights`)
    url.searchParams.set('access_key', apiKey)
    url.searchParams.set('arr_iata', params.arrivalAirport)
    url.searchParams.set('dep_country', params.originCountry)
    url.searchParams.set('flight_date', params.date)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url.toString(), { next: { revalidate: 0 } })
    if (!res.ok) {
      throw new Error(`AviationStack API error: ${res.status} ${await res.text()}`)
    }
    const json = (await res.json()) as AviationStackResponse
    if (json.error) {
      throw new Error(
        `AviationStack API error: ${json.error.code ?? ''} ${json.error.message ?? ''}`,
      )
    }
    const batch = json.data ?? []
    all.push(...batch)

    const total = json.pagination?.total ?? all.length
    offset += batch.length
    if (batch.length === 0 || offset >= total) break
  }

  return all
}
