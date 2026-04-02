const CLOUDBEDS_BASE_URL = 'https://hotels.cloudbeds.com/api/v1.2'

interface CloudbedsReservation {
  reservationID: string
  guestName: string
  guestEmail: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  status: string
}

export interface CloudbedsGuest {
  reservation_id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3, delayMs = 1000): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers })
    if (res.ok) return res

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)))
      continue
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Cloudbeds API auth error: ${res.statusText}`)
    }

    throw new Error(`Cloudbeds API error (${res.status}): ${res.statusText}`)
  }
  throw new Error('Cloudbeds API: max retries exceeded')
}

/**
 * Fetch recent reservations from Cloudbeds.
 * Only active if CLOUDBEDS_API_KEY is set.
 */
export async function fetchRecentGuests(daysBack = 30): Promise<CloudbedsGuest[]> {
  const apiKey = process.env.CLOUDBEDS_API_KEY
  const propertyId = process.env.CLOUDBEDS_PROPERTY_ID

  if (!apiKey) {
    throw new Error('CLOUDBEDS_API_KEY not configured')
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const checkInFrom = new Date()
  checkInFrom.setDate(checkInFrom.getDate() - daysBack)
  const checkInFromStr = checkInFrom.toISOString().split('T')[0]
  const checkInToStr = new Date().toISOString().split('T')[0]

  let url = `${CLOUDBEDS_BASE_URL}/getReservations?status=checked_in,checked_out&checkInFrom=${checkInFromStr}&checkInTo=${checkInToStr}&resultsFrom=1&resultsTo=100`
  if (propertyId) {
    url += `&propertyID=${propertyId}`
  }

  const res = await fetchWithRetry(url, headers)
  const json = await res.json()

  if (!json.success || !json.data) {
    return []
  }

  const guests: CloudbedsGuest[] = []
  for (const r of json.data as CloudbedsReservation[]) {
    guests.push({
      reservation_id: r.reservationID,
      guest_name: r.guestName || '',
      guest_email: (r.guestEmail || '').toLowerCase().trim(),
      guest_phone: normalizePhone(r.guestPhone || ''),
      check_in: r.checkInDate,
      check_out: r.checkOutDate,
    })
  }

  return guests
}

function normalizePhone(phone: string): string {
  // Strip all non-digits, then normalize Taiwan mobile format
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('886') && digits.length >= 12) {
    return '0' + digits.slice(3)
  }
  if (digits.startsWith('+886')) {
    return '0' + digits.slice(4)
  }
  return digits
}

export function isCloudbedsConfigured(): boolean {
  return !!process.env.CLOUDBEDS_API_KEY
}
