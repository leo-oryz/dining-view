import { createServiceClient } from '@/lib/supabase/server'
import { fetchHolidays } from './client'
import { transformHoliday, type HolidayRow } from './transformer'

export const CALENDARIFIC_COUNTRIES = [
  'VN', 'CN', 'KR', 'TH', 'TW', 'SG', 'HK', 'MY', 'PH',
] as const

export interface CalendarificSyncResult {
  synced: number
  errors: string[]
}

export async function syncHolidays(): Promise<CalendarificSyncResult> {
  if (!process.env.CALENDARIFIC_API_KEY) {
    return { synced: 0, errors: [] }
  }

  const supabase = createServiceClient()
  const currentYear = new Date().getUTCFullYear()
  const years = [currentYear, currentYear + 1]

  const errors: string[] = []
  const rows: HolidayRow[] = []

  for (const country of CALENDARIFIC_COUNTRIES) {
    for (const year of years) {
      try {
        const raw = await fetchHolidays({ countryCode: country, year })
        for (const h of raw) {
          const row = transformHoliday(h, country)
          if (row) rows.push(row)
        }
      } catch (err) {
        errors.push(
          `${country} ${year}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  if (rows.length === 0) return { synced: 0, errors }

  const { error } = await supabase
    .from('holidays')
    .upsert(rows, { onConflict: 'country_code,date,name', ignoreDuplicates: false })

  if (error) {
    errors.push(`Upsert failed: ${error.message}`)
    return { synced: 0, errors }
  }

  return { synced: rows.length, errors }
}
