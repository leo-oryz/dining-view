import type { AviationStackFlight } from './client'

const AVG_NARROW_BODY_SEATS = 180

export interface WeeklyCapacity {
  arrivalAirport: string
  originCountry: string
  weekStart: string
  flightCount: number
  totalSeats: number
}

export function getWeekStart(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  const dayOfWeek = d.getUTCDay() // 0 = Sunday
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - ((dayOfWeek + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

export function aggregateWeekly(
  flights: AviationStackFlight[],
  arrivalAirport: string,
  originCountry: string,
): WeeklyCapacity[] {
  const buckets = new Map<string, number>()

  for (const f of flights) {
    if (!f.flight_date) continue
    const week = getWeekStart(f.flight_date)
    buckets.set(week, (buckets.get(week) ?? 0) + 1)
  }

  return Array.from(buckets.entries())
    .map(([weekStart, flightCount]) => ({
      arrivalAirport,
      originCountry,
      weekStart,
      flightCount,
      totalSeats: flightCount * AVG_NARROW_BODY_SEATS,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}
