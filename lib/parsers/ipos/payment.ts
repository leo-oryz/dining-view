// Parses payment_methods_report.xlsx — first 2 rows are headers, data starts row 3.
// Layout (1-indexed columns):
//   1  Ngày                      DD/MM/YYYY
//   2  VISA > Tổng PTTT          count
//   3  VISA > Tổng tiền          amount
//   4  TRANSFER > Tổng PTTT      count
//   5  TRANSFER > Tổng tiền      amount
//   6  DEPOSIT > Tổng PTTT       count
//   7  DEPOSIT > Tổng tiền       amount
//   8  Tiền mặt > Tổng PTTT      count
//   9  Tiền mặt > Tổng tiền      amount
//  10  Tổng > Tổng PTTT          total count
//  11  Tổng > Tổng tiền          total amount

import * as XLSX from 'xlsx'
import type { ParseResult, PaymentRow } from './types'
import { computeDateRange, parseVietnameseDate, toInt } from './utils'

export function parsePaymentMethods(buffer: ArrayBuffer): ParseResult<PaymentRow> {
  const errors: string[] = []
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { rows: [], dateRange: { start: '', end: '' }, errors: ['payment_methods_report: no sheets found'] }
  }
  const sheet = wb.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][]

  const rows: PaymentRow[] = []
  for (let i = 0; i < grid.length; i++) {
    const r = grid[i]
    if (!r || r.length === 0) continue
    const dateCell = r[0]
    if (typeof dateCell !== 'string') continue
    const iso = parseVietnameseDate(dateCell)
    if (!iso) continue

    const visaCount     = toInt(r[1])
    const visaAmount    = toInt(r[2])
    const transferCount = toInt(r[3])
    const transferAmount= toInt(r[4])
    const depositCount  = toInt(r[5])
    const depositAmount = toInt(r[6])
    const cashCount     = toInt(r[7])
    const cashAmount    = toInt(r[8])

    const totalAmount = visaAmount + transferAmount + depositAmount + cashAmount
    if (totalAmount === 0) continue

    rows.push({
      date: iso,
      visa_amount: visaAmount,
      visa_count: visaCount,
      transfer_amount: transferAmount,
      transfer_count: transferCount,
      deposit_amount: depositAmount,
      deposit_count: depositCount,
      cash_amount: cashAmount,
      cash_count: cashCount,
    })
  }

  if (rows.length === 0) errors.push('payment_methods_report: no payment rows found')

  return {
    rows,
    dateRange: computeDateRange(rows.map(r => r.date)),
    errors,
  }
}
