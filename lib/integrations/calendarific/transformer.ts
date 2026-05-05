import type { CalendarificHoliday } from './client'

export interface HolidayRow {
  country_code: string
  date: string
  name: string
  name_local: string | null
  type: 'public' | 'observance' | 'regional'
  year: number
}

function classifyType(types: string[] | undefined): HolidayRow['type'] {
  if (!types?.length) return 'regional'
  const lowered = types.map((t) => t.toLowerCase())
  if (lowered.some((t) => t.includes('national') || t === 'public holiday')) {
    return 'public'
  }
  if (lowered.some((t) => t.includes('observance'))) return 'observance'
  return 'regional'
}

export function transformHoliday(
  raw: CalendarificHoliday,
  countryCode: string,
): HolidayRow | null {
  const iso = raw.date?.iso?.slice(0, 10)
  if (!iso || !raw.name) return null

  const year = Number(iso.slice(0, 4))
  if (!Number.isFinite(year)) return null

  return {
    country_code: countryCode,
    date: iso,
    name: raw.name,
    name_local: null,
    type: classifyType(raw.type),
    year,
  }
}
