import type { ParseError } from './eat365Summary'

interface DailyClosingSession {
  startTime?: string
  endTime?: string
  dineInAmount?: number
  dineInCustomer?: number
  takeoutAmount?: number
  takeoutCustomer?: number
}

interface DailyClosingChannel {
  amount?: number
  quantity?: number
  numberOfGuests?: number
  netSales?: { amount?: number; quantity?: number }
}

export interface DailyClosingReportJSON {
  startDate?: string
  endDate?: string
  dineIn?: DailyClosingChannel
  takeout?: DailyClosingChannel
  sessionList?: DailyClosingSession[]
}

export interface DailyClosingSyntheticRow {
  date: string
  order_number: string
  order_type: 'Dine-in' | 'Takeout'
  time: string
  guest_count: number | null
  item_name: '__order__'
  item_amount: number
  item_quantity: number
}

function parseHourFromTime(t?: string): number | null {
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null
}

function midpointTimestamp(date: string, startTime?: string, endTime?: string): string {
  const start = parseHourFromTime(startTime)
  const end = parseHourFromTime(endTime)
  let hour = start ?? end ?? 12
  let minute = 0
  if (startTime && endTime) {
    const sm = startTime.match(/^(\d{1,2}):(\d{2})/)
    const em = endTime.match(/^(\d{1,2}):(\d{2})/)
    if (sm && em) {
      const sMin = parseInt(sm[1], 10) * 60 + parseInt(sm[2], 10)
      const eMin = parseInt(em[1], 10) * 60 + parseInt(em[2], 10)
      const midMin = Math.floor((sMin + eMin) / 2)
      hour = Math.floor(midMin / 60)
      minute = midMin % 60
    }
  }
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${date} ${hh}:${mm}:00`
}

/**
 * Convert eat365 daily closing report JSON into synthetic order_items rows.
 * Each session entry produces up to two rows (one per channel) representing
 * the aggregated orders within that 30-minute window. For sessions with no
 * activity, falls back to the dineIn/takeout day totals so the daily chart
 * still has data points.
 */
export function parseEat365DailyClosing(
  json: DailyClosingReportJSON,
  date: string
): { data: DailyClosingSyntheticRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: DailyClosingSyntheticRow[] = []

  if (!json) {
    errors.push({ row: 0, field: '', message: 'empty payload' })
    return { data, errors }
  }

  const sessions = Array.isArray(json.sessionList) ? json.sessionList : []
  let dineInOrdersFromSessions = 0
  let dineInRevenueFromSessions = 0
  let takeoutOrdersFromSessions = 0
  let takeoutRevenueFromSessions = 0

  sessions.forEach((s, idx) => {
    const ts = midpointTimestamp(date, s.startTime, s.endTime)

    const dineCust = Number(s.dineInCustomer) || 0
    const dineAmt = Number(s.dineInAmount) || 0
    if (dineCust > 0 || dineAmt > 0) {
      data.push({
        date,
        order_number: `__dc_${date}_dineIn_s${idx}`,
        order_type: 'Dine-in',
        time: ts,
        guest_count: dineCust || null,
        item_name: '__order__',
        item_amount: dineAmt,
        item_quantity: dineCust || 1,
      })
      dineInOrdersFromSessions += dineCust
      dineInRevenueFromSessions += dineAmt
    }

    const takeCust = Number(s.takeoutCustomer) || 0
    const takeAmt = Number(s.takeoutAmount) || 0
    if (takeCust > 0 || takeAmt > 0) {
      data.push({
        date,
        order_number: `__dc_${date}_takeout_s${idx}`,
        order_type: 'Takeout',
        time: ts,
        guest_count: takeCust || null,
        item_name: '__order__',
        item_amount: takeAmt,
        item_quantity: takeCust || 1,
      })
      takeoutOrdersFromSessions += takeCust
      takeoutRevenueFromSessions += takeAmt
    }
  })

  // If session list was empty or didn't sum to the daily totals, emit single
  // catch-all rows so the daily chart still reflects the reported aggregates.
  const dayDineQty = Number(json.dineIn?.quantity) || 0
  const dayDineAmt = Number(json.dineIn?.amount) || 0
  const dayTakeQty = Number(json.takeout?.quantity) || 0
  const dayTakeAmt = Number(json.takeout?.amount) || 0

  if (dayDineQty > dineInOrdersFromSessions || dayDineAmt > dineInRevenueFromSessions) {
    const missingQty = Math.max(0, dayDineQty - dineInOrdersFromSessions)
    const missingAmt = Math.max(0, dayDineAmt - dineInRevenueFromSessions)
    if (missingQty > 0 || missingAmt > 0) {
      data.push({
        date,
        order_number: `__dc_${date}_dineIn_total`,
        order_type: 'Dine-in',
        time: `${date} 12:00:00`,
        guest_count: missingQty || null,
        item_name: '__order__',
        item_amount: missingAmt,
        item_quantity: missingQty || 1,
      })
    }
  }
  if (dayTakeQty > takeoutOrdersFromSessions || dayTakeAmt > takeoutRevenueFromSessions) {
    const missingQty = Math.max(0, dayTakeQty - takeoutOrdersFromSessions)
    const missingAmt = Math.max(0, dayTakeAmt - takeoutRevenueFromSessions)
    if (missingQty > 0 || missingAmt > 0) {
      data.push({
        date,
        order_number: `__dc_${date}_takeout_total`,
        order_type: 'Takeout',
        time: `${date} 12:00:00`,
        guest_count: missingQty || null,
        item_name: '__order__',
        item_amount: missingAmt,
        item_quantity: missingQty || 1,
      })
    }
  }

  return { data, errors }
}
