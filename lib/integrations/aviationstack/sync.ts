import { createServiceClient } from '@/lib/supabase/server'
import { fetchFlights, ORIGIN_COUNTRY_NAMES } from './client'
import { aggregateWeekly, getWeekStart } from './aggregator'

export interface AviationStackSyncResult {
  airport: string
  routesProcessed: number
  rowsUpserted: number
  errors: string[]
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function syncFlightCapacity(): Promise<AviationStackSyncResult> {
  const airport = process.env.AVIATIONSTACK_AIRPORT ?? 'SGN'

  const result: AviationStackSyncResult = {
    airport,
    routesProcessed: 0,
    rowsUpserted: 0,
    errors: [],
  }

  if (!process.env.AVIATIONSTACK_API_KEY) return result

  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const currentWeekStart = getWeekStart(today)

  // Sample one date per week (current week + 4 forward) to keep API usage low
  // on the free tier — flight schedules are stable week-to-week.
  const sampleDates = Array.from({ length: 5 }, (_, i) =>
    addDaysIso(currentWeekStart, i * 7),
  )

  const countryEntries = Object.entries(ORIGIN_COUNTRY_NAMES)

  for (const [code, name] of countryEntries) {
    result.routesProcessed += 1
    const weekTotals = new Map<string, { flights: number; seats: number }>()

    try {
      for (const date of sampleDates) {
        const flights = await fetchFlights({
          arrivalAirport: airport,
          originCountry: name,
          date,
        })
        const weekly = aggregateWeekly(flights, airport, code)
        for (const w of weekly) {
          const existing = weekTotals.get(w.weekStart) ?? { flights: 0, seats: 0 }
          existing.flights += w.flightCount
          existing.seats += w.totalSeats
          weekTotals.set(w.weekStart, existing)
        }
      }
    } catch (err) {
      result.errors.push(
        `${code}: ${err instanceof Error ? err.message : String(err)}`,
      )
      continue
    }

    if (weekTotals.size === 0) continue

    // Look up previous-week capacity for WoW comparison
    const earliestWeek = sampleDates[0]
    const prevWeek = addDaysIso(earliestWeek, -7)
    const { data: priorRows } = await supabase
      .from('flight_capacity')
      .select('week_start, total_seats')
      .eq('arrival_airport', airport)
      .eq('origin_country', code)
      .gte('week_start', prevWeek)
      .order('week_start', { ascending: true })

    const priorMap = new Map<string, number>(
      (priorRows ?? []).map((r) => [r.week_start as string, Number(r.total_seats)]),
    )

    const sortedWeeks = Array.from(weekTotals.keys()).sort()
    const upsertRows = sortedWeeks.map((weekStart, idx) => {
      const totals = weekTotals.get(weekStart)!
      const prevWeekStart =
        idx === 0 ? addDaysIso(weekStart, -7) : sortedWeeks[idx - 1]
      const prevSeats =
        idx === 0
          ? priorMap.get(prevWeekStart)
          : weekTotals.get(prevWeekStart)?.seats ?? priorMap.get(prevWeekStart)

      let wow: number | null = null
      if (prevSeats && prevSeats > 0) {
        wow = Number((((totals.seats - prevSeats) / prevSeats) * 100).toFixed(2))
      }

      return {
        arrival_airport: airport,
        origin_country: code,
        week_start: weekStart,
        total_seats: totals.seats,
        flight_count: totals.flights,
        wow_change_pct: wow,
        updated_at: new Date().toISOString(),
      }
    })

    const { error: upsertError } = await supabase
      .from('flight_capacity')
      .upsert(upsertRows, {
        onConflict: 'arrival_airport,origin_country,week_start',
        ignoreDuplicates: false,
      })

    if (upsertError) {
      result.errors.push(`${code} upsert: ${upsertError.message}`)
      continue
    }

    result.rowsUpserted += upsertRows.length
  }

  return result
}
