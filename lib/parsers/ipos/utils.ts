// Date / number helpers shared across iPOS parsers.

// Excel serial → ISO date (YYYY-MM-DD).
// Excel's epoch is 1899-12-30 UTC; iPOS exports day-aligned serials, so the
// fractional part is the time-of-day in HCM and irrelevant to the date label.
// We compute purely in UTC components to avoid TZ drift on the host machine.
export function excelSerialToDate(serial: number): string {
  const days = Math.floor(serial)
  const utc = new Date(Date.UTC(1899, 11, 30))
  utc.setUTCDate(utc.getUTCDate() + days)
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// "01/04/2026" → "2026-04-01"
export function parseVietnameseDate(dateStr: string): string | null {
  if (!dateStr) return null
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// "18h - 19h" → 18, "0h - 1h" → 0
export function parseHourSlot(slot: string): number | null {
  if (!slot) return null
  const m = slot.replace(/\s/g, '').match(/^(\d{1,2})h-\d{1,2}h$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  if (isNaN(h) || h < 0 || h > 23) return null
  return h
}

// Coerce iPOS numeric cells (numbers, "1.234.567" / "1,234,567" strings, blanks)
// into a plain integer VND amount.
export function toInt(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0
  const s = String(v).trim()
  if (!s || s === '-') return 0
  // Strip thousand separators (both . and ,) but preserve a leading minus.
  const cleaned = s.replace(/[.,\s]/g, '')
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? 0 : n
}

export function computeDateRange(dates: string[]): { start: string; end: string } {
  if (dates.length === 0) return { start: '', end: '' }
  const sorted = [...dates].sort()
  return { start: sorted[0], end: sorted[sorted.length - 1] }
}
