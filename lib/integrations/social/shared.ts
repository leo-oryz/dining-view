// HCM is UTC+7 with no DST. Convert a UTC date to YYYY-MM-DD in HCM time.
const HCM_OFFSET_MS = 7 * 60 * 60 * 1000

export function toHcmDateString(input: Date | string | number): string {
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  const shifted = new Date(d.getTime() + HCM_OFFSET_MS)
  return shifted.toISOString().slice(0, 10)
}

export function unixToHcmDate(unixSeconds: number): string {
  return toHcmDateString(unixSeconds * 1000)
}

export function ymdNow(): string {
  return toHcmDateString(Date.now())
}

export function daysAgoUnix(days: number): number {
  return Math.floor((Date.now() - days * 86_400_000) / 1000)
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

// Pick sync window: 30 days on first run, 3 days on subsequent runs.
export function syncWindowDays(lastSyncedAt: string | null | undefined): number {
  if (!lastSyncedAt) return 30
  return 3
}
