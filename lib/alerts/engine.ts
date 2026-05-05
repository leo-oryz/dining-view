import { createServiceClient } from '@/lib/supabase/server'

export type AlertType =
  | 'flight_spike'
  | 'holiday_peak'
  | 'revenue_drop'
  | 'no_show_spike'
  | 'low_covers'

const FLIGHT_SPIKE_PCT = 15
const REVENUE_DROP_RATIO = 0.7
const COVER_DROP_RATIO = 0.6
const NO_SHOW_RATE_PCT = 20
const HOLIDAY_LOOKAHEAD_DAYS = 5
const DUPLICATE_WINDOW_HOURS = 24

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

function vnToday(): string {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatVndAmount(n: number): string {
  return Math.round(n).toLocaleString('vi-VN').replace(/,/g, '.')
}

interface DuplicateCheck {
  storeId: string
  alertType: AlertType
  matcher?: (data: Record<string, unknown> | null) => boolean
}

type SupabaseClient = ReturnType<typeof createServiceClient>

async function alreadyFiredRecently(
  supabase: SupabaseClient,
  check: DuplicateCheck,
): Promise<boolean> {
  const since = new Date(
    Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString()
  const { data } = await supabase
    .from('alert_history')
    .select('id, data')
    .eq('store_id', check.storeId)
    .eq('alert_type', check.alertType)
    .gte('triggered_at', since)

  if (!data || data.length === 0) return false
  if (!check.matcher) return true
  return data.some((row) => check.matcher!(row.data as Record<string, unknown> | null))
}

async function isAlertEnabled(
  supabase: SupabaseClient,
  storeId: string,
  alertType: AlertType,
): Promise<boolean> {
  const { data } = await supabase
    .from('alert_rules')
    .select('is_active')
    .eq('store_id', storeId)
    .eq('alert_type', alertType)
    .maybeSingle()
  // Default ON if no row yet
  if (!data) return true
  return data.is_active === true
}

async function fireAlert(
  supabase: SupabaseClient,
  storeId: string,
  alertType: AlertType,
  message: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from('alert_history').insert({
    store_id: storeId,
    alert_type: alertType,
    message,
    data,
  })
  return !error
}

async function checkFlightSpike(
  supabase: SupabaseClient,
  storeId: string,
): Promise<number> {
  if (!(await isAlertEnabled(supabase, storeId, 'flight_spike'))) return 0
  const airport = process.env.AVIATIONSTACK_AIRPORT ?? 'SGN'
  const today = vnToday()
  const weekStart = addDaysIso(today, -7)

  const { data } = await supabase
    .from('flight_capacity')
    .select('origin_country, week_start, wow_change_pct, total_seats, flight_count')
    .eq('arrival_airport', airport)
    .gte('week_start', weekStart)
    .gt('wow_change_pct', FLIGHT_SPIKE_PCT)

  if (!data?.length) return 0

  let count = 0
  for (const row of data) {
    const matcher = (d: Record<string, unknown> | null) =>
      d?.origin_country === row.origin_country &&
      d?.week_start === row.week_start
    if (await alreadyFiredRecently(supabase, { storeId, alertType: 'flight_spike', matcher })) {
      continue
    }
    const message = `Flight capacity from ${row.origin_country} to ${airport} up ${row.wow_change_pct}% this week — expect higher inbound tourists`
    if (
      await fireAlert(supabase, storeId, 'flight_spike', message, {
        origin_country: row.origin_country,
        arrival_airport: airport,
        week_start: row.week_start,
        wow_change_pct: row.wow_change_pct,
        total_seats: row.total_seats,
        flight_count: row.flight_count,
      })
    ) {
      count += 1
    }
  }
  return count
}

async function checkHolidayPeak(
  supabase: SupabaseClient,
  storeId: string,
): Promise<number> {
  if (!(await isAlertEnabled(supabase, storeId, 'holiday_peak'))) return 0

  const today = vnToday()
  const horizon = addDaysIso(today, HOLIDAY_LOOKAHEAD_DAYS)

  const { data } = await supabase
    .from('holidays')
    .select('country_code, date, name, type')
    .eq('type', 'public')
    .gte('date', today)
    .lte('date', horizon)

  if (!data?.length) return 0

  let count = 0
  for (const row of data) {
    const matcher = (d: Record<string, unknown> | null) =>
      d?.country_code === row.country_code &&
      d?.date === row.date &&
      d?.name === row.name
    if (await alreadyFiredRecently(supabase, { storeId, alertType: 'holiday_peak', matcher })) {
      continue
    }
    const message = `Public holiday in ${row.country_code} on ${row.date} (${row.name}) — potential tourist arrival peak`
    if (
      await fireAlert(supabase, storeId, 'holiday_peak', message, {
        country_code: row.country_code,
        date: row.date,
        name: row.name,
      })
    ) {
      count += 1
    }
  }
  return count
}

async function checkRevenueDrop(
  supabase: SupabaseClient,
  storeId: string,
): Promise<number> {
  if (!(await isAlertEnabled(supabase, storeId, 'revenue_drop'))) return 0
  const today = vnToday()
  const sevenAgo = addDaysIso(today, -7)

  const { data } = await supabase
    .from('daily_sales')
    .select('date, net_revenue')
    .eq('store_id', storeId)
    .gte('date', sevenAgo)
    .lte('date', today)
    .order('date', { ascending: true })

  if (!data?.length) return 0
  const todayRow = data.find((r) => r.date === today)
  const history = data.filter((r) => r.date !== today && r.net_revenue !== null)
  if (!todayRow || todayRow.net_revenue === null || history.length === 0) return 0

  const avg =
    history.reduce((sum, r) => sum + Number(r.net_revenue ?? 0), 0) / history.length
  const todayValue = Number(todayRow.net_revenue)
  if (avg <= 0 || todayValue >= avg * REVENUE_DROP_RATIO) return 0

  const matcher = (d: Record<string, unknown> | null) => d?.date === today
  if (await alreadyFiredRecently(supabase, { storeId, alertType: 'revenue_drop', matcher })) {
    return 0
  }

  const pctBelow = Math.round((1 - todayValue / avg) * 100)
  const message = `Revenue today (${formatVndAmount(todayValue)} ₫) is ${pctBelow}% below 7-day average`
  return (await fireAlert(supabase, storeId, 'revenue_drop', message, {
    date: today,
    today_revenue: todayValue,
    avg_revenue_7d: Math.round(avg),
    pct_below: pctBelow,
  }))
    ? 1
    : 0
}

async function checkLowCovers(
  supabase: SupabaseClient,
  storeId: string,
): Promise<number> {
  if (!(await isAlertEnabled(supabase, storeId, 'low_covers'))) return 0
  const today = vnToday()
  const sevenAgo = addDaysIso(today, -7)

  const { data } = await supabase
    .from('daily_sales')
    .select('date, guests')
    .eq('store_id', storeId)
    .gte('date', sevenAgo)
    .lte('date', today)
    .order('date', { ascending: true })

  if (!data?.length) return 0
  const todayRow = data.find((r) => r.date === today)
  const history = data.filter((r) => r.date !== today && r.guests !== null)
  if (!todayRow || todayRow.guests === null || history.length === 0) return 0

  const avg =
    history.reduce((sum, r) => sum + Number(r.guests ?? 0), 0) / history.length
  const todayCovers = Number(todayRow.guests)
  if (avg <= 0 || todayCovers >= avg * COVER_DROP_RATIO) return 0

  const matcher = (d: Record<string, unknown> | null) => d?.date === today
  if (await alreadyFiredRecently(supabase, { storeId, alertType: 'low_covers', matcher })) {
    return 0
  }

  const pctBelow = Math.round((1 - todayCovers / avg) * 100)
  const message = `Cover count today (${todayCovers}) is ${pctBelow}% below 7-day average`
  return (await fireAlert(supabase, storeId, 'low_covers', message, {
    date: today,
    today_covers: todayCovers,
    avg_covers_7d: Math.round(avg),
    pct_below: pctBelow,
  }))
    ? 1
    : 0
}

async function checkNoShowSpike(
  supabase: SupabaseClient,
  storeId: string,
): Promise<number> {
  if (!(await isAlertEnabled(supabase, storeId, 'no_show_spike'))) return 0
  const today = vnToday()
  const sevenAgo = addDaysIso(today, -7)

  const { data, error } = await supabase
    .from('reservations')
    .select('id, no_show, status')
    .eq('store_id', storeId)
    .gte('reserved_at', `${sevenAgo}T00:00:00+07:00`)
    .lte('reserved_at', `${today}T23:59:59+07:00`)

  if (error || !data?.length) return 0

  const considered = data.filter((r) => r.status !== 'cancelled')
  if (considered.length === 0) return 0
  const noShows = considered.filter((r) => r.no_show === true).length
  const ratePct = (noShows / considered.length) * 100
  if (ratePct <= NO_SHOW_RATE_PCT) return 0

  const matcher = (d: Record<string, unknown> | null) => d?.window_end === today
  if (await alreadyFiredRecently(supabase, { storeId, alertType: 'no_show_spike', matcher })) {
    return 0
  }

  const rounded = Math.round(ratePct)
  const message = `No-show rate is ${rounded}% over the last 7 days — above ${NO_SHOW_RATE_PCT}% threshold`
  return (await fireAlert(supabase, storeId, 'no_show_spike', message, {
    window_start: sevenAgo,
    window_end: today,
    rate_pct: rounded,
    no_shows: noShows,
    total_reservations: considered.length,
  }))
    ? 1
    : 0
}

export interface AlertEngineResult {
  storeId: string
  triggered: number
  byType: Partial<Record<AlertType, number>>
}

export async function runAlertChecks(storeId: string): Promise<AlertEngineResult> {
  const supabase = createServiceClient()
  const byType: Partial<Record<AlertType, number>> = {}

  byType.flight_spike = await checkFlightSpike(supabase, storeId)
  byType.holiday_peak = await checkHolidayPeak(supabase, storeId)
  byType.revenue_drop = await checkRevenueDrop(supabase, storeId)
  byType.low_covers = await checkLowCovers(supabase, storeId)
  byType.no_show_spike = await checkNoShowSpike(supabase, storeId)

  const triggered = Object.values(byType).reduce<number>((s, v) => s + (v ?? 0), 0)
  return { storeId, triggered, byType }
}

export async function runAlertChecksForAllStores(): Promise<AlertEngineResult[]> {
  const supabase = createServiceClient()
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)
  if (!stores?.length) return []

  const results: AlertEngineResult[] = []
  for (const s of stores) {
    results.push(await runAlertChecks(s.id))
  }
  return results
}
