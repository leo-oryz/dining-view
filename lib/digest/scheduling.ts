// Compute the next firing time (UTC) for a report schedule based on its
// wall-clock fields and timezone. The dispatcher uses this to populate
// next_run_at on insert/update and after each fire.

export type ScheduleTimeFields = {
  frequency: 'weekly' | 'monthly'
  day_of_week: number | null   // 1=Mon ... 7=Sun (ISO)
  day_of_month: number | null  // 1-28
  send_hour: number
  send_minute: number
  timezone: string             // IANA, e.g. 'Asia/Ho_Chi_Minh'
}

import { APP_TIMEZONE } from '@/lib/constants/timezone'

// Returns the next instant >= fromUtc at which the schedule should fire,
// expressed as a UTC Date.
export function computeNextRunAt(s: ScheduleTimeFields, fromUtc: Date = new Date()): Date {
  const tz = s.timezone || APP_TIMEZONE
  const wall = wallClockComponents(fromUtc, tz)

  if (s.frequency === 'weekly') {
    const targetDow = s.day_of_week!
    let daysUntil = (targetDow - wall.isoDow + 7) % 7
    if (daysUntil === 0) {
      const passed =
        wall.hour > s.send_hour ||
        (wall.hour === s.send_hour && wall.minute >= s.send_minute)
      if (passed) daysUntil = 7
    }
    return tzWallToUtc(wall.year, wall.month, wall.day + daysUntil, s.send_hour, s.send_minute, tz)
  }

  // monthly
  const targetDom = s.day_of_month!
  let year = wall.year
  let month = wall.month
  const passedThisMonth =
    wall.day > targetDom ||
    (wall.day === targetDom && (
      wall.hour > s.send_hour ||
      (wall.hour === s.send_hour && wall.minute >= s.send_minute)
    ))
  if (passedThisMonth) {
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return tzWallToUtc(year, month, targetDom, s.send_hour, s.send_minute, tz)
}

function wallClockComponents(utc: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short', hour12: false,
  })
  const parts = fmt.formatToParts(utc)
  const get = (t: string) => parts.find(p => p.type === t)?.value || '0'
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  let hour = Number(get('hour'))
  // Some Node versions emit "24" for midnight; normalize.
  if (hour === 24) hour = 0
  const minute = Number(get('minute'))
  const wd = get('weekday')
  // ISO: Mon=1 ... Sun=7
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const isoDow = dowMap[wd] ?? 1
  return { year, month, day, hour, minute, isoDow }
}

// Convert a wall-clock time (year/month/day/hour/minute) in tz to a UTC Date.
function tzWallToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  // Pretend the wall-clock is UTC, then subtract the tz offset at that instant.
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMs = tzOffsetMs(new Date(guess), tz)
  return new Date(guess - offsetMs)
}

function tzOffsetMs(utc: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(utc)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0)
  let h = get('hour')
  if (h === 24) h = 0
  const wallUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'))
  return wallUtc - utc.getTime()
}
